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

/**
 * Paid hours for one day: the punch-to-punch span, minus the unpaid break.
 *
 * The break is only taken off when the day is actually longer than it — someone who came
 * in for a half-hour errand should not end up with negative hours. The deduction happens
 * here at calculation time rather than being baked into the stored record, so changing the
 * break length recalculates history instead of corrupting it.
 */
export function paidHoursForDay(
  record: Pick<AttendanceRecord, 'checkIn' | 'checkOut' | 'hoursWorked' | 'punches'>,
  settings: AttendanceSettings = DEFAULT_ATTENDANCE_SETTINGS
): number {
  const punches = (record.punches || []).filter(Boolean).slice().sort();

  /**
   * Four or more punches means they clocked out for lunch and back in, so the day splits
   * into real worked segments: (1st→2nd) is the first half, (3rd→4th) the second, and the
   * gap between them is lunch — excluded exactly, no estimating.
   *
   * An odd punch at the end is someone who has not clocked out yet. It is left unpaired
   * rather than guessed at, so a forgotten evening punch shows as short hours instead of
   * silently paying for time nobody can account for.
   */
  if (punches.length >= 3) {
    let total = 0;
    for (let i = 0; i + 1 < punches.length; i += 2) {
      total += hoursBetween(punches[i], punches[i + 1]);
    }
    return round2(total);
  }

  if (!record.checkIn || !record.checkOut) return 0;

  /**
   * Two punches only — nobody clocked out for lunch, so the span still contains it.
   * The configured break is deducted instead. Only when the day is actually longer than
   * the break: a half-hour errand must not come out negative.
   */
  const span = record.hoursWorked || hoursBetween(record.checkIn, record.checkOut);
  const breakHours = (settings.breakMinutes || 0) / 60;

  return round2(span > breakHours ? span - breakHours : span);
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
