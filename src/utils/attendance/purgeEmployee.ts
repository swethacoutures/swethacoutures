/**
 * Deleting an employee everywhere they exist.
 *
 * The back office keeps one person in five places, joined only by their fingerprint code:
 *
 *   staff/{id} .................. the HR card, created on the Employees page
 *   attendanceEmployees/{code} .. the fingerprint identity the device writes to
 *   attendanceRecords ........... one row per day worked
 *   devicePunches ............... every individual press of the sensor
 *   salaryPayments .............. what has been paid to them, by month
 *
 * Deleting only the first of those used to be all the Employees page did. The rest stayed
 * behind, invisible on that screen but very much alive: the deleted person still appeared
 * on the Admin Dashboard's "Attendance Today", still owned their device number, and the
 * moment a NEW employee was given that same number the old identity absorbed them —
 * punches and all.
 *
 * So a delete now clears every trace. That is a real trade: attendance history for that
 * person is gone, including any month not yet paid. `describeFootprint` exists so the
 * confirmation can say exactly what is about to be lost, counted from the live data,
 * before anybody agrees to it.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/utils/activityLog';
import {
  EMPLOYEES_COLLECTION,
  PAYMENTS_COLLECTION,
  RECORDS_COLLECTION,
} from './attendanceStore';
import { PUNCHES_COLLECTION } from './deviceStore';

/** Firestore refuses a batch larger than this, so writes are chunked. */
const BATCH_LIMIT = 450;

export interface EmployeeFootprint {
  /** The fingerprint code this person owns, if any. */
  empCode?: string;
  attendanceEmployee: boolean;
  records: number;
  punches: number;
  payments: number;
}

export interface PurgeTarget {
  /** `staff` document id. Optional — an attendance-only identity has no HR card. */
  staffId?: string;
  /** Fingerprint device number. Optional — an HR card may never have been linked. */
  empCode?: string;
  /** For the activity log and the confirmation copy. */
  name: string;
}

/** Every document id in `collectionName` whose `field` equals `value`. */
async function idsWhere(
  collectionName: string,
  field: string,
  value: string
): Promise<string[]> {
  const snapshot = await getDocs(query(collection(db, collectionName), where(field, '==', value)));
  return snapshot.docs.map((entry) => entry.id);
}

/**
 * Counts what a delete would remove, so the confirmation can name real numbers.
 *
 * Reads only. Safe to call while the admin is still deciding.
 */
export async function describeFootprint(target: PurgeTarget): Promise<EmployeeFootprint> {
  const code = (target.empCode || '').trim();
  if (!code) {
    return { attendanceEmployee: false, records: 0, punches: 0, payments: 0 };
  }

  const [employeeSnap, records, punches, payments] = await Promise.all([
    getDocs(query(collection(db, EMPLOYEES_COLLECTION), where('empCode', '==', code))),
    idsWhere(RECORDS_COLLECTION, 'empCode', code),
    idsWhere(PUNCHES_COLLECTION, 'userPin', code),
    idsWhere(PAYMENTS_COLLECTION, 'empCode', code),
  ]);

  return {
    empCode: code,
    attendanceEmployee: !employeeSnap.empty,
    records: records.length,
    punches: punches.length,
    payments: payments.length,
  };
}

/** Deletes ids from one collection, chunked to stay inside Firestore's batch limit. */
async function deleteAll(collectionName: string, ids: string[]): Promise<void> {
  for (let index = 0; index < ids.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const id of ids.slice(index, index + BATCH_LIMIT)) {
      batch.delete(doc(db, collectionName, id));
    }
    await batch.commit();
  }
}

/**
 * Removes an employee and everything joined to them.
 *
 * Order matters. The fingerprint identity goes LAST, because it is what the device
 * re-creates on the next punch: clearing it first would let a punch arriving mid-delete
 * rebuild the identity and strand a fresh record behind the sweep that has already run.
 */
export async function purgeEmployee(target: PurgeTarget): Promise<EmployeeFootprint> {
  const code = (target.empCode || '').trim();
  const footprint = await describeFootprint(target);

  if (code) {
    const [records, punches, payments] = await Promise.all([
      idsWhere(RECORDS_COLLECTION, 'empCode', code),
      idsWhere(PUNCHES_COLLECTION, 'userPin', code),
      idsWhere(PAYMENTS_COLLECTION, 'empCode', code),
    ]);

    await deleteAll(RECORDS_COLLECTION, records);
    await deleteAll(PUNCHES_COLLECTION, punches);
    await deleteAll(PAYMENTS_COLLECTION, payments);
  }

  if (target.staffId) {
    await deleteDoc(doc(db, 'staff', target.staffId));
  }

  if (code) {
    await deleteDoc(doc(db, EMPLOYEES_COLLECTION, code)).catch(() => {
      /* Already gone is a fine outcome for a delete. */
    });
  }

  await logActivity({
    action: 'delete',
    entity: 'attendanceEmployee',
    entityId: code || target.staffId || target.name,
    summary:
      `Deleted ${target.name}${code ? ` (device ${code})` : ''} and all their data — ` +
      `${footprint.records} day record(s), ${footprint.punches} punch(es), ` +
      `${footprint.payments} salary payment(s)`,
  }).catch(() => {
    /* The delete itself succeeded; a missing log line must not report it as failed. */
  });

  return footprint;
}
