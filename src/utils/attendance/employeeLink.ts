/**
 * Bridges the Employees page (`staff` collection) and the biometric attendance module
 * (`attendanceEmployees` / `attendanceRecords`).
 *
 * The two collections are deliberately separate — attendance is device-driven and keyed by
 * the fingerprint employee code, while `staff` holds the HR record. This module is the one
 * place that joins them, so an employee's pay basis lives in a single spot and their payable
 * salary can be derived from real check-in / check-out times.
 */
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  EMPLOYEES_COLLECTION,
  fetchAttendanceSettings,
  fetchEmployees,
  fetchRecords,
  saveEmployee,
} from './attendanceStore';
import { calculateSalary, monthBounds, toMonthKey } from './salaryCalc';
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceEmployee,
  type AttendanceRecord,
  type AttendanceSettings,
  type SalaryMode,
} from './types';

export interface StaffPay {
  id: string;
  name?: string;
  salaryMode?: SalaryMode;
  salaryAmount?: number;
  bonus?: number;
  /** The employee's number on the fingerprint device, typed in on the Employees page. */
  attendanceEmpCode?: string;
  /** Paid hours in a normal day for this person. */
  standardHoursPerDay?: number;
}

export interface AttendanceSummary {
  /** The matched attendance employee, if any. */
  empCode?: string;
  matchedBy: 'code' | 'name' | 'none';
  daysPresent: number;
  hoursWorked: number;
  workingDays: number;
  /** Salary earned for the period from attendance, before bonus. */
  earned: number;
  bonus: number;
  /** earned + bonus — what the business owes this employee for the period. */
  payable: number;
  formula: string;
  lastCheckIn?: string;
  lastCheckOut?: string;
  lastDate?: string;
}

const normalise = (value?: string) => (value || '').trim().toLowerCase();

/**
 * Finds the attendance employee for a staff record.
 *
 * Prefers the explicit link (`staff.attendanceEmpCode`, or the attendance side's
 * `linkedStaffId`) and falls back to an exact name match, which covers the common case
 * where the same person was typed into both places without anyone linking them.
 */
export function matchAttendanceEmployee(
  staff: StaffPay,
  employees: AttendanceEmployee[]
): { employee?: AttendanceEmployee; matchedBy: 'code' | 'name' | 'none' } {
  if (staff.attendanceEmpCode) {
    const byCode = employees.find((e) => e.empCode === staff.attendanceEmpCode);
    if (byCode) return { employee: byCode, matchedBy: 'code' };
  }

  const byLink = employees.find((e) => e.linkedStaffId && e.linkedStaffId === staff.id);
  if (byLink) return { employee: byLink, matchedBy: 'code' };

  const byName = employees.find((e) => normalise(e.name) === normalise(staff.name));
  if (byName) return { employee: byName, matchedBy: 'name' };

  return { matchedBy: 'none' };
}

/**
 * Payable salary for one staff member over a month, derived from their attendance.
 *
 * Pay basis and rate come from the *staff* record — that is the form the admin fills in —
 * while days and hours come from the fingerprint records. If the staff record has no rate
 * set, the attendance employee's own rate is used as a fallback.
 */
export function summariseAttendance(
  staff: StaffPay,
  employees: AttendanceEmployee[],
  records: AttendanceRecord[],
  periodKey: string = toMonthKey(new Date()),
  settings: AttendanceSettings = DEFAULT_ATTENDANCE_SETTINGS
): AttendanceSummary {
  const { employee, matchedBy } = matchAttendanceEmployee(staff, employees);
  const { start, end } = monthBounds(periodKey);
  const bonus = staff.bonus || 0;

  if (!employee) {
    return {
      matchedBy: 'none',
      daysPresent: 0,
      hoursWorked: 0,
      workingDays: 0,
      earned: 0,
      bonus,
      payable: bonus,
      formula: 'No attendance record linked',
    };
  }

  // Staff rate wins; attendance rate is the fallback for employees set up on that side first.
  const effective: AttendanceEmployee = {
    ...employee,
    salaryMode: (staff.salaryMode || employee.salaryMode) ?? null,
    salaryAmount: staff.salaryAmount || employee.salaryAmount || 0,
  };

  const breakdown = calculateSalary(effective, records, start, end, settings);
  const own = records
    .filter((record) => record.empCode === employee.empCode && record.date >= start && record.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    empCode: employee.empCode,
    matchedBy,
    daysPresent: breakdown.daysWorked,
    hoursWorked: breakdown.hoursWorked,
    workingDays: breakdown.workingDays,
    earned: breakdown.amount,
    bonus,
    payable: breakdown.amount + bonus,
    formula: breakdown.formula,
    lastCheckIn: own[0]?.checkIn,
    lastCheckOut: own[0]?.checkOut,
    lastDate: own[0]?.date,
  };
}

/** Loads everything needed to summarise a whole staff list for one month, in two reads. */
export async function loadAttendanceContext(periodKey: string = toMonthKey(new Date())): Promise<{
  employees: AttendanceEmployee[];
  records: AttendanceRecord[];
  settings: AttendanceSettings;
}> {
  const { start, end } = monthBounds(periodKey);
  const [employees, records, settings] = await Promise.all([
    fetchEmployees(),
    fetchRecords(start, end),
    fetchAttendanceSettings(),
  ]);
  return { employees, records, settings };
}

/**
 * Makes the attendance side match the Employees page.
 *
 * The Employees page is the ONE place pay is decided — basis, amount, standard hours — and
 * the one place the admin types the employee's number from the fingerprint device. This
 * mirrors all of that onto the attendance employee, **creating it if it does not exist yet**.
 *
 * That creation step is the important part. An admin sets somebody up on their first day,
 * before they have ever put a finger on the machine, so there is nothing on the attendance
 * side to update. Without this the person simply would not appear in Payroll until their
 * first punch, and the pay entered on their record would sit there doing nothing.
 *
 * Returns the employee code it wrote to, or null when there is nothing to link to (no code
 * entered and no name match) — an unlinked staff member is a normal state, not an error.
 */
export async function syncPayToAttendance(
  staff: StaffPay,
  employees: AttendanceEmployee[]
): Promise<string | null> {
  const { employee } = matchAttendanceEmployee(staff, employees);
  const code = (staff.attendanceEmpCode || '').trim();

  // Nothing to attach to, and no number to create one under.
  if (!employee && !code) return null;

  const payload = {
    salaryMode: (staff.salaryMode || null) as SalaryMode | null,
    salaryAmount: staff.salaryAmount || 0,
    standardHoursPerDay: staff.standardHoursPerDay || 8,
    linkedStaffId: staff.id,
    /*
     * 🔴 The name is pushed unconditionally, the same as every other field above.
     *
     * The bug this fixes: an admin types a device code that used to belong to somebody
     * else — the old employee was deleted from the Employees page, which does NOT touch
     * this attendanceEmployees doc (see the delete note in Staff.tsx). `matchAttendanceEmployee`
     * still finds that old doc by code and this function used to merge only the pay
     * fields into it, leaving the PREVIOUS person's name in place forever. Every punch
     * from the new employee then displayed under the old employee's name, silently and
     * with no error — exactly what happened when "Ali" was assigned code 1 after "GOVA"
     * had used it.
     *
     * Typing a device code on this page is the admin's explicit statement of who that
     * code belongs to now, so the name here wins the same way the pay fields already do.
     * This never fights `applyUserInfoNames` — that guards a different case (the
     * terminal's own guess at a name), not an admin's deliberate assignment.
     */
    name: staff.name || employee?.name || code,
  };

  if (employee) {
    await saveEmployee(employee.empCode, payload);
  } else {
    /*
     * No attendance employee under this code yet. `setDoc` with merge rather than the
     * stricter createManualEmployee, because the device may create the very same document
     * a moment later when the person first punches — a merge lets the two meet in the
     * middle instead of one of them throwing.
     */
    await setDoc(
      doc(db, EMPLOYEES_COLLECTION, code),
      {
        ...payload, // name is already in here, computed above
        empCode: code,
        active: true,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  const written = employee ? employee.empCode : code;

  // Record the link on the staff side too, so a later rename cannot break the match.
  if (staff.attendanceEmpCode !== written) {
    await updateDoc(doc(db, 'staff', staff.id), { attendanceEmpCode: written });
  }

  return written;
}
