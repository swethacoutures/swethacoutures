/**
 * Salary maths. Pure functions only — no Firestore, no React — so the money logic
 * can be reasoned about and tested in isolation from the UI that displays it.
 */
import { buildDayTimeline } from './punchSessions';
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceEmployee,
  type AttendanceRecord,
  type AttendanceSettings,
} from './types';

export interface SalaryBreakdown {
  daysWorked: number;
  /** Raw time between first and last punch, before the break is taken off. */
  hoursWorked: number;
  /** What the employee is actually paid for: hoursWorked minus the unpaid break each day. */
  paidHours: number;
  /** Working days in the period — the divisor behind the hourly rate. */
  workingDays: number;
  /** workingDays x standardHoursPerDay. What a full month looks like. */
  expectedHours: number;
  /** salaryAmount / expectedHours. Shown so the number can be checked by hand. */
  hourlyRate: number;
  /**
   * Hours worked beyond the employee's standard day, summed across the period.
   *
   * Counted a day at a time so a late evening is actually visible, instead of netting
   * itself out against a short day later in the month.
   */
  overtimeHours: number;
  /** How many separate days ran long. What the payroll banner counts. */
  overtimeDays: number;
  /**
   * What the overtime hours are worth, at the same hourly rate. ALREADY INCLUDED in
   * `amount` — it is a breakdown, not an addition. Zero on a daily wage, where a flat
   * day rate is paid however long the day ran.
   */
  overtimePay: number;
  amount: number;
  /** True when the employee has no salary mode/amount set yet. */
  needsSetup: boolean;
  /** Human-readable explanation of how `amount` was reached. */
  formula: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** 'YYYY-MM-DD' -> Date at local midnight. Avoids the UTC shift of `new Date(str)`. */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** Date -> 'YYYY-MM-DD' using local time, matching how punch dates are stored. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Working days between two dates inclusive, skipping the shop's weekly off days.
 *
 * Defaults to Sunday-only, the common six-day week for a tailoring shop. Excluding
 * Saturday as well would shrink the divisor and quietly inflate everyone's hourly rate.
 */
export function countWorkingDays(
  startDate: string,
  endDate: string,
  weeklyOffDays: number[] = DEFAULT_ATTENDANCE_SETTINGS.weeklyOffDays
): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (end < start) return 0;

  const off = new Set(weeklyOffDays);
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (!off.has(cursor.getDay())) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/*
 * Repeat-press handling used to live here, as `dedupePunches`. It now belongs to
 * `groupRuns` in ./punchSessions, which needs to know not just which presses to drop but
 * WHETHER any were dropped — that fact is what tells an odd punch count caused by a
 * collapsed repeat apart from a genuinely forgotten check-out. Keeping a second copy of
 * the rule here would let the two drift, and they decide the same money.
 */

/**
 * Paid hours for one day.
 *
 * The rule, in order:
 *
 * 1. An explicit hours override beats everything.
 * 2. A record an admin has corrected by hand wins next. The stored `punches` array
 *    survives a manual edit (the write merges), so reading punches first would quietly
 *    ignore the correction and keep paying the number the admin just fixed — the edit
 *    would show in the table and do nothing to the payslip.
 * 3. Otherwise the day is read as PERIODS: check-in to check-out, added together. That
 *    whole reading lives in `buildDayTimeline`, which is also what the Records and Punches
 *    tabs display, so the number on screen and the number on the payslip cannot drift.
 *
 * All of this happens at calculation time rather than being baked into the stored record,
 * so changing a rule recalculates history instead of corrupting it.
 */
export function paidHoursForDay(
  record: Pick<
    AttendanceRecord,
    'checkIn' | 'checkOut' | 'hoursWorked' | 'punches' | 'manuallyEdited' | 'overrideHours'
  >,
  settings: AttendanceSettings = DEFAULT_ATTENDANCE_SETTINGS
): number {
  const breakHours =
    Math.max(0, settings.breakMinutes ?? DEFAULT_ATTENDANCE_SETTINGS.breakMinutes) / 60;

  /** Time on the premises, less one standard break. Never negative. */
  const lessFixedBreak = (spanHours: number): number =>
    round2(spanHours > breakHours ? spanHours - breakHours : spanHours);

  /*
   * (0) An explicit hours override beats everything — including a manual time correction.
   * It is the escape hatch for a day the rules get wrong, so nothing below may second-guess
   * it. Checked with `typeof` rather than truthiness because 0 is a legitimate override.
   */
  if (typeof record.overrideHours === 'number' && Number.isFinite(record.overrideHours)) {
    return round2(Math.max(0, record.overrideHours));
  }

  // (1) A hand-corrected day is the admin's word against the device's. The admin wins.
  if (record.manuallyEdited) {
    if (!record.checkIn || !record.checkOut) return 0;
    return lessFixedBreak(record.hoursWorked || hoursBetween(record.checkIn, record.checkOut));
  }

  // (2) The periods, exactly as the Records tab draws them.
  if ((record.punches || []).length >= 2) {
    return round2(buildDayTimeline(record.punches || [], settings).paidMinutes / 60);
  }

  /*
   * No usable punch array — a day an admin added by hand, or a single press with no
   * check-out. Fall back to the stored times; a day that never closed pays nothing.
   */
  if (!record.checkIn || !record.checkOut) return 0;
  return lessFixedBreak(record.hoursWorked || hoursBetween(record.checkIn, record.checkOut));
}

/**
 * Overtime for one day: everything beyond that person's own standard day.
 *
 * Per DAY, not per month, because that is the question the shop actually asks — "they
 * stayed three hours late on Tuesday, do I pay for it?" A month-long total silently nets
 * a late Tuesday against an early Friday and nobody ever sees the overtime happen.
 */
export function overtimeHoursForDay(
  record: Parameters<typeof paidHoursForDay>[0],
  standardHoursPerDay: number,
  settings: AttendanceSettings = DEFAULT_ATTENDANCE_SETTINGS
): number {
  const standard = standardHoursPerDay || DEFAULT_ATTENDANCE_SETTINGS.standardHoursPerDay;
  return round2(Math.max(0, paidHoursForDay(record, settings) - standard));
}

/** Minutes between two 'HH:mm' times, as decimal hours. Returns 0 if either is missing. */
export function hoursBetween(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  if ([inH, inM, outH, outM].some((n) => Number.isNaN(n))) return 0;

  let minutes = outH * 60 + outM - (inH * 60 + inM);
  // A checkout before the check-in means the shift crossed midnight.
  if (minutes < 0) minutes += 24 * 60;
  return round2(minutes / 60);
}

/**
 * Computes what an employee earned over a period from their attendance.
 *
 * - daily   → rate x days present, whatever hours they did
 * - hourly  → rate x paid hours
 * - monthly → salary converted to an hourly rate, then paid on hours actually worked.
 *             Hours beyond a full month are overtime at the same rate.
 */
export function calculateSalary(
  employee: AttendanceEmployee,
  records: AttendanceRecord[],
  periodStart: string,
  periodEnd: string,
  settings: AttendanceSettings = DEFAULT_ATTENDANCE_SETTINGS
): SalaryBreakdown {
  const inPeriod = records.filter(
    (record) =>
      record.empCode === employee.empCode &&
      record.date >= periodStart &&
      record.date <= periodEnd
  );

  const daysWorked = inPeriod.filter((record) => !!record.checkIn).length;
  const hoursWorked = round2(
    inPeriod.reduce((sum, record) => sum + (record.hoursWorked || 0), 0)
  );
  const paidHours = round2(
    inPeriod.reduce((sum, record) => sum + paidHoursForDay(record, settings), 0)
  );

  const workingDays = countWorkingDays(periodStart, periodEnd, settings.weeklyOffDays);
  const standardHours = settings.standardHoursPerDay || DEFAULT_ATTENDANCE_SETTINGS.standardHoursPerDay;
  const expectedHours = round2(workingDays * standardHours);

  /*
   * Overtime is counted a day at a time, against THIS employee's standard day.
   *
   * A month-long comparison hides it: nine hours on Monday and seven on Tuesday nets to
   * nothing, and the owner never learns that Monday ran long. Counting per day surfaces
   * every late evening for approval. It does not change what anybody is paid — overtime
   * goes at the same hourly rate, and those hours are already inside `paidHours` — it
   * changes only what the shop is told about them.
   */
  const employeeStandardHours = employee.standardHoursPerDay || standardHours;
  const overtimeHours = round2(
    inPeriod.reduce(
      (sum, record) => sum + overtimeHoursForDay(record, employeeStandardHours, settings),
      0
    )
  );
  const overtimeDays = inPeriod.filter(
    (record) => overtimeHoursForDay(record, employeeStandardHours, settings) > 0
  ).length;

  const base = {
    daysWorked,
    hoursWorked,
    paidHours,
    workingDays,
    expectedHours,
    hourlyRate: 0,
    overtimeHours,
    overtimeDays,
    overtimePay: 0,
  };

  if (!employee.salaryMode || !employee.salaryAmount || employee.salaryAmount <= 0) {
    return { ...base, amount: 0, needsSetup: true, formula: 'Salary not configured' };
  }

  const rate = employee.salaryAmount;

  switch (employee.salaryMode) {
    case 'daily':
      return {
        ...base,
        amount: round2(rate * daysWorked),
        needsSetup: false,
        formula: `₹${rate}/day × ${daysWorked} day${daysWorked === 1 ? '' : 's'} present`,
      };

    case 'hourly':
      return {
        ...base,
        hourlyRate: rate,
        // Overtime is already inside `paidHours`; this only breaks out what it was worth.
        overtimePay: round2(rate * overtimeHours),
        amount: round2(rate * paidHours),
        needsSetup: false,
        formula: `₹${rate}/hr × ${paidHours} hr worked`,
      };

    /**
     * Monthly is paid by the hour, derived from the salary.
     *
     * The month's salary buys a month's hours, so one hour is worth
     * salary ÷ (working days × standard hours). Pay then follows the hours actually
     * worked: arriving late and staying on still earns a full day, leaving early docks
     * only the hours missed, and hours beyond a full month are paid at the same rate
     * rather than being given away.
     */
    case 'monthly': {
      if (expectedHours === 0) {
        return { ...base, amount: 0, needsSetup: false, formula: 'No working days in period' };
      }

      /**
       * The multiplication uses the exact rate, not the rounded one.
       *
       * ₹10,000 / 208 hrs is ₹48.0769…; rounding that to ₹48.08 before multiplying makes
       * exactly half a month pay ₹5,000.32 instead of ₹5,000. The rounded figure is only
       * ever shown, never used in the arithmetic.
       */
      const exactRate = rate / expectedHours;
      const hourlyRate = round2(exactRate);
      const overtimePay = round2(exactRate * overtimeHours);
      const amount = round2(exactRate * paidHours);

      return {
        ...base,
        hourlyRate,
        overtimePay,
        amount,
        needsSetup: false,
        formula:
          `₹${rate}/month ÷ ${expectedHours} hrs = ₹${hourlyRate}/hr × ${paidHours} hrs worked` +
          (overtimeHours > 0 ? ` (incl. ${overtimeHours} hrs overtime)` : ''),
      };
    }

    default:
      return { ...base, amount: 0, needsSetup: true, formula: 'Unknown salary mode' };
  }
}

/** First and last day of a 'YYYY-MM' month, as date keys. */
export function monthBounds(periodKey: string): { start: string; end: string } {
  const [year, month] = periodKey.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // day 0 of next month = last day of this one
  return { start: toDateKey(start), end: toDateKey(end) };
}

/** 'YYYY-MM' for a date. */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 'August 2026' from '2026-08'. */
export function formatMonthLabel(periodKey: string): string {
  const [year, month] = periodKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

/** Rupee formatting consistent with the rest of the app. */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
