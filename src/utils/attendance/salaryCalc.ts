/**
 * Salary maths. Pure functions only — no Firestore, no React — so the money logic
 * can be reasoned about and tested in isolation from the UI that displays it.
 */
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
  /** Hours worked beyond a full month, paid at the same rate. */
  overtimeHours: number;
  /** What the overtime hours are worth. Already included in `amount`. */
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

/** Minutes between two 'HH:mm' times, handling a shift that crosses midnight. */
function minutesBetween(from: string, to: string): number {
  return Math.round(hoursBetween(from, to) * 60);
}

/**
 * Drops repeat presses on the same finger.
 *
 * People press the sensor two or three times when they are not sure it registered, and the
 * terminal itself re-reports a batch after a failed handshake. One real day in this shop's
 * data has sixteen punches between 17:47 and 19:27 — nobody left and came back eight times.
 * Anything arriving within `minPunchGapMinutes` of the punch we already kept is the same
 * event, so it is discarded before any in/out meaning is read into the sequence.
 */
export function dedupePunches(punches: string[], minGapMinutes: number): string[] {
  const sorted = (punches || []).filter(Boolean).slice().sort();
  if (sorted.length === 0) return [];

  const gap = Math.max(0, minGapMinutes);
  const kept = [sorted[0]];

  for (const punch of sorted.slice(1)) {
    if (minutesBetween(kept[kept.length - 1], punch) >= gap) kept.push(punch);
  }

  return kept;
}

/**
 * Paid hours for one day.
 *
 * The rule, in order:
 *
 * 1. A record an admin has corrected by hand wins outright. The stored `punches` array
 *    survives a manual edit (the write merges), so reading punches first would quietly
 *    ignore the correction and keep paying the number the admin just fixed — the edit
 *    would show in the table and do nothing to the payslip.
 * 2. Repeat presses are collapsed (see `dedupePunches`).
 * 3. With an EVEN number of punches left, they pair up cleanly — 1st→2nd worked, 2nd→3rd
 *    away, 3rd→4th worked — and only the away stretches lasting at least `minBreakMinutes`
 *    come off the day. Stepping out for three minutes is not a lunch break.
 * 4. With an ODD number, a punch is missing and the pairing cannot be trusted, so the day
 *    falls back to "time on the premises, less the standard break" — the same rule as a day
 *    with no lunch punch at all.
 *
 * ⚠️ Point 4 is not a tidy-up, it is the fix for a real miscalculation. Collapsing a repeat
 * press can turn an even sequence odd, and then every gap's meaning flips: a day punched
 * 09:00, 12:00, 12:03, 18:00 (a three-minute step outside) collapses to three punches, and
 * reading the parity would call 12:00→18:00 "time away" and pay 3 hours for a 9-hour day.
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

  const minPunchGap =
    settings.minPunchGapMinutes ?? DEFAULT_ATTENDANCE_SETTINGS.minPunchGapMinutes;
  const minBreak = settings.minBreakMinutes ?? DEFAULT_ATTENDANCE_SETTINGS.minBreakMinutes;
  const punches = dedupePunches(record.punches || [], minPunchGap);

  if (punches.length >= 2) {
    const spanHours = minutesBetween(punches[0], punches[punches.length - 1]) / 60;

    /*
     * Odd means a punch is missing, so the in/out pairing below would be reading the gaps
     * backwards. Fall back rather than guess.
     *
     * The span is taken from the DE-DUPLICATED punches, not from `record.hoursWorked` —
     * that stored figure is first-to-last of the raw presses, so a stray press two minutes
     * after clocking off would otherwise still stretch the day.
     */
    if (punches.length % 2 === 1) return lessFixedBreak(spanHours);

    // (3) Two punches is one unbroken stretch with no lunch punched, so the standard break
    // comes off. Four or more, and the real absences are visible and used exactly.
    if (punches.length === 2) return lessFixedBreak(spanHours);

    let awayMinutes = 0;
    // Odd-indexed gaps are out→in. Even-indexed ones are time actually worked.
    for (let i = 1; i + 1 < punches.length; i += 2) {
      const gap = minutesBetween(punches[i], punches[i + 1]);
      if (gap >= minBreak) awayMinutes += gap;
    }

    return round2(Math.max(0, spanHours * 60 - awayMinutes) / 60);
  }

  // A single punch: clocked in and never out. Nothing is guessed.
  if (!record.checkIn || !record.checkOut) return 0;
  return lessFixedBreak(record.hoursWorked || hoursBetween(record.checkIn, record.checkOut));
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

  const base = {
    daysWorked,
    hoursWorked,
    paidHours,
    workingDays,
    expectedHours,
    hourlyRate: 0,
    overtimeHours: 0,
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
      const overtimeHours = round2(Math.max(0, paidHours - expectedHours));
      const overtimePay = round2(exactRate * overtimeHours);
      const amount = round2(exactRate * paidHours);

      return {
        ...base,
        hourlyRate,
        overtimeHours,
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
