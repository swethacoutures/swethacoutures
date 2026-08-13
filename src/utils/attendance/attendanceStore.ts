/**
 * Firestore access for the attendance module.
 *
 * Collections used (all new — nothing existing is touched):
 *   attendanceEmployees  doc id = empCode
 *   attendanceRecords    doc id = `${empCode}_${date}`
 *   salaryPayments       doc id = `${empCode}_${periodKey}`
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { hoursBetween } from './salaryCalc';
import { logActivity } from '@/utils/activityLog';
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceEmployee,
  type AttendanceRecord,
  type AttendanceSettings,
  type SalaryPayment,
  type SalaryMode,
} from './types';

export const EMPLOYEES_COLLECTION = 'attendanceEmployees';
export const RECORDS_COLLECTION = 'attendanceRecords';
export const PAYMENTS_COLLECTION = 'salaryPayments';

/** Firestore rejects a batch over 500 writes; 400 leaves room for the sync-state write. */
const BATCH_LIMIT = 400;

const nowIso = () => new Date().toISOString();

/** Doc ID for a day record. Deterministic — this is what makes sync idempotent. */
export const recordId = (empCode: string, date: string) => `${empCode}_${date}`;

/** Doc ID for a month's payment. */
export const paymentId = (empCode: string, periodKey: string) => `${empCode}_${periodKey}`;

/* ------------------------------------------------------------------ employees */

export async function fetchEmployees(): Promise<AttendanceEmployee[]> {
  const snapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
  return snapshot.docs
    .map((snap) => ({ id: snap.id, ...snap.data() }) as AttendanceEmployee)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function saveEmployee(
  empCode: string,
  data: Partial<AttendanceEmployee>,
  options: { audit?: boolean } = {}
): Promise<void> {
  // Read first so the log can show what the value used to be.
  const before = options.audit
    ? ((await getDoc(doc(db, EMPLOYEES_COLLECTION, empCode))).data() as Record<string, unknown>)
    : undefined;

  await setDoc(
    doc(db, EMPLOYEES_COLLECTION, empCode),
    { ...data, empCode, updatedAt: nowIso() },
    { merge: true }
  );

  // Only hand edits are logged. The device feed writes here constantly and would bury
  // the entries that a human actually needs to find.
  if (options.audit) {
    await logActivity({
      action: 'edit',
      entity: 'attendanceEmployee',
      entityId: empCode,
      summary: `Edited employee ${before?.name || empCode}`,
      before,
      after: { ...before, ...data } as Record<string, unknown>,
    });
  }
}

export async function createManualEmployee(input: {
  empCode: string;
  name: string;
  department?: string;
  salaryMode: SalaryMode | null;
  salaryAmount: number;
  standardHoursPerDay: number;
  active?: boolean;
  /** Optional cross-reference to a `staff` document, set at creation time. */
  linkedStaffId?: string;
}): Promise<void> {
  const existing = await getDoc(doc(db, EMPLOYEES_COLLECTION, input.empCode));
  if (existing.exists()) {
    throw new Error(
      `Employee code "${input.empCode}" already exists — it belongs to ` +
        `${(existing.data() as AttendanceEmployee).name || 'someone else'}. ` +
        `Use the code from the fingerprint device, and edit that row instead of adding a second one.`
    );
  }

  await setDoc(doc(db, EMPLOYEES_COLLECTION, input.empCode), {
    ...input,
    department: input.department || '',
    linkedStaffId: input.linkedStaffId || '',
    active: input.active ?? true,
    source: 'manual',
    firstSeenAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  await logActivity({
    action: 'create',
    entity: 'attendanceEmployee',
    entityId: input.empCode,
    summary: `Added employee ${input.name} (code ${input.empCode}) by hand`,
    after: {
      name: input.name,
      salaryMode: input.salaryMode,
      salaryAmount: input.salaryAmount,
      linkedStaffId: input.linkedStaffId || '',
    },
  });
}

/**
 * Records the link on both sides of the join.
 *
 * `attendanceEmployees.linkedStaffId` alone is only half a link: `matchAttendanceEmployee`
 * checks `staff.attendanceEmpCode` first, and the Employees page reads from there. Writing
 * only one direction is why a link could look set on the attendance side and still show
 * "No attendance record linked" on the staff page.
 */
export async function linkEmployeeToStaff(empCode: string, staffId: string): Promise<void> {
  await setDoc(
    doc(db, EMPLOYEES_COLLECTION, empCode),
    { linkedStaffId: staffId, updatedAt: nowIso() },
    { merge: true }
  );

  if (staffId) {
    await setDoc(
      doc(db, 'staff', staffId),
      { attendanceEmpCode: empCode },
      { merge: true }
    );
  }
}

export async function deleteEmployee(empCode: string): Promise<void> {
  const before = (await getDoc(doc(db, EMPLOYEES_COLLECTION, empCode))).data() as
    | Record<string, unknown>
    | undefined;

  await deleteDoc(doc(db, EMPLOYEES_COLLECTION, empCode));

  /**
   * Clear the pointer on the staff side too.
   *
   * `matchAttendanceEmployee` looks up `staff.attendanceEmpCode` first. Left behind, it
   * points at a code that no longer exists, so the staff row silently falls back to
   * matching by name — or to nothing at all — and nobody can see why.
   */
  const linkedStaffId = before?.linkedStaffId as string | undefined;
  if (linkedStaffId) {
    await setDoc(doc(db, 'staff', linkedStaffId), { attendanceEmpCode: '' }, { merge: true }).catch(
      (error) => console.error('[attendance] could not clear the staff link', error)
    );
  }

  await logActivity({
    action: 'delete',
    entity: 'attendanceEmployee',
    entityId: empCode,
    summary: `Deleted employee ${before?.name || empCode}`,
    before,
  });
}

/* -------------------------------------------------------------------- records */

/**
 * Records within a date range. Dates are 'YYYY-MM-DD' strings, which sort
 * lexicographically in the same order as chronologically, so range queries work
 * directly on the string field without a separate timestamp.
 */
export async function fetchRecords(
  startDate?: string,
  endDate?: string
): Promise<AttendanceRecord[]> {
  const constraints = [];
  if (startDate) constraints.push(where('date', '>=', startDate));
  if (endDate) constraints.push(where('date', '<=', endDate));

  const snapshot = await getDocs(
    constraints.length
      ? query(collection(db, RECORDS_COLLECTION), ...constraints, orderBy('date', 'desc'))
      : query(collection(db, RECORDS_COLLECTION), orderBy('date', 'desc'))
  );

  return snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }) as AttendanceRecord);
}

/**
 * Writes or corrects one day by hand. Marks the record `manuallyEdited` so a later
 * sync will not silently revert the admin's correction.
 */
export async function saveRecordManually(input: {
  empCode: string;
  employeeName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
}): Promise<void> {
  const id = recordId(input.empCode, input.date);
  const hoursWorked = hoursBetween(input.checkIn, input.checkOut);
  const before = (await getDoc(doc(db, RECORDS_COLLECTION, id))).data() as
    | Record<string, unknown>
    | undefined;

  await setDoc(
    doc(db, RECORDS_COLLECTION, id),
    {
      empCode: input.empCode,
      employeeName: input.employeeName,
      date: input.date,
      checkIn: input.checkIn || '',
      checkOut: input.checkOut || '',
      hoursWorked,
      status: input.checkOut ? 'present' : 'incomplete',
      source: 'manual',
      manuallyEdited: true,
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  await logActivity({
    action: before ? 'edit' : 'create',
    entity: 'attendanceRecord',
    entityId: id,
    summary:
      `${before ? 'Edited' : 'Added'} attendance for ${input.employeeName} on ${input.date}` +
      ` (${input.checkIn || '—'} to ${input.checkOut || '—'})`,
    before,
    after: {
      checkIn: input.checkIn || '',
      checkOut: input.checkOut || '',
      hoursWorked,
      manuallyEdited: true,
    },
  });
}

export async function deleteRecord(id: string): Promise<void> {
  const before = (await getDoc(doc(db, RECORDS_COLLECTION, id))).data() as
    | Record<string, unknown>
    | undefined;

  await deleteDoc(doc(db, RECORDS_COLLECTION, id));

  await logActivity({
    action: 'delete',
    entity: 'attendanceRecord',
    entityId: id,
    summary: `Deleted attendance for ${before?.employeeName || id} on ${before?.date || '?'}`,
    before,
  });
}

/**
 * Deletes many day records at once.
 *
 * Chunked to stay under Firestore's batch limit, and logged as **one** audit entry rather
 * than one per record — a bulk clear-out that wrote three hundred lines into `activityLog`
 * would bury every individual correction anyone had ever made, which is exactly what the
 * log exists to preserve. The summary names the range and the count, which is what someone
 * reconstructing a disputed month actually needs to know.
 */
export async function deleteRecords(
  records: Pick<AttendanceRecord, 'id' | 'date' | 'employeeName' | 'empCode'>[],
  context: string
): Promise<number> {
  if (records.length === 0) return 0;

  for (let offset = 0; offset < records.length; offset += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const record of records.slice(offset, offset + BATCH_LIMIT)) {
      batch.delete(doc(db, RECORDS_COLLECTION, record.id));
    }
    await batch.commit();
  }

  const dates = records.map((record) => record.date).sort();
  await logActivity({
    action: 'delete',
    entity: 'attendanceRecord',
    entityId: `bulk:${records.length}`,
    summary:
      `Deleted ${records.length} attendance record${records.length === 1 ? '' : 's'} (${context})` +
      (dates.length ? ` covering ${dates[0]} to ${dates[dates.length - 1]}` : ''),
    before: {
      count: records.length,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      employees: [...new Set(records.map((record) => record.employeeName || record.empCode))],
    },
  });

  return records.length;
}

/**
 * Bulk-writes day records from a sync run, chunked to stay under Firestore's batch limit.
 *
 * Only genuinely changed records are written. The page re-syncs every 60 seconds over a
 * multi-day overlap window, so writing every record every cycle would cost thousands of
 * pointless Firestore writes a day and grow with headcount. Unchanged days are skipped.
 *
 * Records flagged `manuallyEdited` keep their admin-corrected times; only the raw punch
 * audit trail is refreshed, and only if it actually differs.
 */
export async function writeRecordsBatch(
  records: Omit<AttendanceRecord, 'id'>[],
  existing: Map<string, AttendanceRecord>
): Promise<number> {
  const pending: { id: string; data: Record<string, unknown> }[] = [];

  for (const record of records) {
    const id = recordId(record.empCode, record.date);
    const prior = existing.get(id);

    if (prior?.manuallyEdited) {
      const samePunches =
        JSON.stringify(prior.punches || []) === JSON.stringify(record.punches || []);
      if (!samePunches) {
        pending.push({ id, data: { punches: record.punches || [], updatedAt: nowIso() } });
      }
      continue;
    }

    if (
      prior &&
      (prior.checkIn || '') === (record.checkIn || '') &&
      (prior.checkOut || '') === (record.checkOut || '') &&
      (prior.hoursWorked || 0) === (record.hoursWorked || 0) &&
      prior.employeeName === record.employeeName
    ) {
      continue; // Nothing changed for this day.
    }

    pending.push({ id, data: { ...record, updatedAt: nowIso() } });
  }

  for (let offset = 0; offset < pending.length; offset += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const item of pending.slice(offset, offset + BATCH_LIMIT)) {
      batch.set(doc(db, RECORDS_COLLECTION, item.id), item.data, { merge: true });
    }
    await batch.commit();
  }

  return pending.length;
}

/**
 * Existing records in a window, keyed by doc ID. Sync uses this both to skip unchanged
 * days and to recognise the ones an admin has hand-corrected.
 */
export async function fetchExistingRecordMap(
  startDate: string,
  endDate: string
): Promise<Map<string, AttendanceRecord>> {
  const snapshot = await getDocs(
    query(
      collection(db, RECORDS_COLLECTION),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    )
  );

  const map = new Map<string, AttendanceRecord>();
  snapshot.docs.forEach((snap) => {
    map.set(snap.id, { id: snap.id, ...snap.data() } as AttendanceRecord);
  });
  return map;
}

/* ------------------------------------------------------------------- payments */

export async function fetchPayments(periodKey?: string): Promise<SalaryPayment[]> {
  const snapshot = await getDocs(
    periodKey
      ? query(collection(db, PAYMENTS_COLLECTION), where('periodKey', '==', periodKey))
      : collection(db, PAYMENTS_COLLECTION)
  );
  return snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }) as SalaryPayment);
}

export async function markPaid(input: {
  empCode: string;
  employeeName: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  daysWorked: number;
  hoursWorked: number;
  salaryMode: SalaryMode | null;
  paidBy: string;
}): Promise<void> {
  await setDoc(doc(db, PAYMENTS_COLLECTION, paymentId(input.empCode, input.periodKey)), {
    ...input,
    status: 'paid',
    paidAt: nowIso(),
    // Clear any prior revert so the record reads cleanly if re-paid.
    revertedAt: '',
    revertedBy: '',
  });

  await logActivity({
    action: 'pay',
    entity: 'salaryPayment',
    entityId: paymentId(input.empCode, input.periodKey),
    summary: `Marked ${input.employeeName} paid ₹${input.amount} for ${input.periodKey}`,
    after: { amount: input.amount, daysWorked: input.daysWorked, hoursWorked: input.hoursWorked },
  });
}

/**
 * Undo. Soft revert rather than delete, so an accidental click and its correction
 * both remain on the record.
 *
 * `setDoc(..., { merge: true })` rather than `updateDoc`, which fails outright if the
 * document has gone. Undo is the button someone reaches for when something has already
 * gone wrong; refusing to work because the record it was undoing is missing would be the
 * worst possible moment to be strict. A revert on nothing leaves a reverted marker, which
 * is exactly what the payroll table then reads as "not paid".
 */
export async function undoPayment(
  empCode: string,
  periodKey: string,
  revertedBy: string
): Promise<void> {
  const id = paymentId(empCode, periodKey);
  const before = (await getDoc(doc(db, PAYMENTS_COLLECTION, id))).data() as
    | Record<string, unknown>
    | undefined;

  await setDoc(
    doc(db, PAYMENTS_COLLECTION, id),
    {
      empCode,
      periodKey,
      status: 'reverted',
      revertedAt: nowIso(),
      revertedBy,
    },
    { merge: true }
  );

  await logActivity({
    action: 'undo-pay',
    entity: 'salaryPayment',
    entityId: id,
    summary:
      `Undid the ${periodKey} payment for ${before?.employeeName || empCode}` +
      (before?.amount ? ` (₹${before.amount})` : ''),
    before: { status: before?.status || 'unknown', amount: before?.amount },
    after: { status: 'reverted' },
  });
}

/* ------------------------------------------------------------------- settings */

const SETTINGS_DOC = 'attendance';

/**
 * Shop-wide attendance rules, or the defaults if nobody has set them yet.
 *
 * Missing fields fall back individually rather than the whole document falling back, so a
 * partially-saved document cannot leave `standardHoursPerDay` at zero and divide the
 * hourly rate by nothing.
 */
export async function fetchAttendanceSettings(): Promise<AttendanceSettings> {
  const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC));
  if (!snap.exists()) return { ...DEFAULT_ATTENDANCE_SETTINGS };

  const saved = snap.data() as Partial<AttendanceSettings>;
  return {
    officeStartTime: saved.officeStartTime || DEFAULT_ATTENDANCE_SETTINGS.officeStartTime,
    officeEndTime: saved.officeEndTime || DEFAULT_ATTENDANCE_SETTINGS.officeEndTime,
    standardHoursPerDay:
      Number(saved.standardHoursPerDay) > 0
        ? Number(saved.standardHoursPerDay)
        : DEFAULT_ATTENDANCE_SETTINGS.standardHoursPerDay,
    breakMinutes:
      Number.isFinite(Number(saved.breakMinutes)) && Number(saved.breakMinutes) >= 0
        ? Number(saved.breakMinutes)
        : DEFAULT_ATTENDANCE_SETTINGS.breakMinutes,
    minPunchGapMinutes:
      Number.isFinite(Number(saved.minPunchGapMinutes)) && Number(saved.minPunchGapMinutes) >= 0
        ? Number(saved.minPunchGapMinutes)
        : DEFAULT_ATTENDANCE_SETTINGS.minPunchGapMinutes,
    minBreakMinutes:
      Number.isFinite(Number(saved.minBreakMinutes)) && Number(saved.minBreakMinutes) >= 0
        ? Number(saved.minBreakMinutes)
        : DEFAULT_ATTENDANCE_SETTINGS.minBreakMinutes,
    weeklyOffDays: Array.isArray(saved.weeklyOffDays)
      ? saved.weeklyOffDays
      : DEFAULT_ATTENDANCE_SETTINGS.weeklyOffDays,
    updatedAt: saved.updatedAt,
    updatedBy: saved.updatedBy,
  };
}

export async function saveAttendanceSettings(
  settings: AttendanceSettings,
  updatedBy: string
): Promise<void> {
  const before = (await getDoc(doc(db, 'settings', SETTINGS_DOC))).data() as
    | Record<string, unknown>
    | undefined;

  await setDoc(
    doc(db, 'settings', SETTINGS_DOC),
    { ...settings, updatedAt: nowIso(), updatedBy },
    { merge: true }
  );

  // Changing these changes everyone's pay, so it belongs in the audit trail even though
  // it is not an edit to any one person's record.
  await logActivity({
    action: 'settings',
    entity: 'attendanceSettings',
    entityId: SETTINGS_DOC,
    summary: 'Changed the shop working rules',
    before,
    after: settings as unknown as Record<string, unknown>,
  });
}
