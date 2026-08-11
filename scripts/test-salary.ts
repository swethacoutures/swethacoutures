/**
 * Salary maths tests.
 *
 * These decide what real people are paid, so the worked examples below are written the way
 * the shop owner described them rather than the way the code is structured.
 *
 *   npm run test:salary
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Loads the real salary module without modifying it.
 *
 * `src/` uses extensionless relative imports because Vite resolves them; raw Node ESM
 * cannot. Rather than change production code to suit the test runner, the two modules
 * under test are copied to a temp folder with `.ts` appended to their relative imports.
 * The code being tested is byte-for-byte what ships, apart from that import suffix.
 */
function loadSalaryModule() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salary-test-'));
  for (const name of ['salaryCalc.ts', 'types.ts']) {
    const source = fs.readFileSync(path.join('src', 'utils', 'attendance', name), 'utf8');
    fs.writeFileSync(
      path.join(dir, name),
      source.replace(/from '\.\/([A-Za-z0-9_]+)'/g, "from './$1.ts'")
    );
  }
  return import(pathToFileURL(path.join(dir, 'salaryCalc.ts')).href);
}

const { calculateSalary, countWorkingDays, paidHoursForDay } = await loadSalaryModule();

type AttendanceEmployee = Record<string, unknown>;
type AttendanceRecord = Record<string, unknown>;
type AttendanceSettings = {
  officeStartTime: string;
  officeEndTime: string;
  standardHoursPerDay: number;
  breakMinutes: number;
  weeklyOffDays: number[];
};

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
const section = (t: string) => console.log(`\n\x1b[1m${t}\x1b[0m`);

const SETTINGS: AttendanceSettings = {
  officeStartTime: '09:00',
  officeEndTime: '18:00',
  standardHoursPerDay: 8,
  breakMinutes: 60,
  weeklyOffDays: [0],
};

const monthly = (amount: number): AttendanceEmployee =>
  ({
    id: '1', empCode: '1', name: 'Test', salaryMode: 'monthly', salaryAmount: amount,
    standardHoursPerDay: 8, active: true, source: 'device',
  }) as AttendanceEmployee;

/**
 * A worked day, given as the clock times the device actually reports.
 * Pass two times for someone who never punched for lunch, or four for someone who did.
 */
const day = (date: string, ...times: string[]): AttendanceRecord => {
  const sorted = [...times].sort();
  const checkIn = sorted[0];
  const checkOut = sorted.length > 1 ? sorted[sorted.length - 1] : '';
  const mins = (t: string) => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);
  const span = checkOut ? Math.round(((mins(checkOut) - mins(checkIn)) / 60) * 100) / 100 : 0;
  return {
    id: `1_${date}`, empCode: '1', employeeName: 'Test', date,
    checkIn, checkOut, hoursWorked: span, punches: sorted, status: 'present', source: 'device',
  } as AttendanceRecord;
};

/* ------------------------------------------------------------- break handling */

section('The unpaid break');
{
  check('9:00-18:00 with a 1h break = 8 paid hours',
    paidHoursForDay(day('2026-08-03', '09:00', '18:00'), SETTINGS) === 8);
  check('9:00-20:00 with a 1h break = 10 paid hours',
    paidHoursForDay(day('2026-08-03', '09:00', '20:00'), SETTINGS) === 10);
  check('a 30-minute visit is not turned negative by a 1h break',
    paidHoursForDay(day('2026-08-03', '09:00', '09:30'), SETTINGS) === 0.5,
    String(paidHoursForDay(day('2026-08-03', '09:00', '09:30'), SETTINGS)));
  check('a day with no check-out pays nothing',
    paidHoursForDay({ checkIn: '09:00', checkOut: '', hoursWorked: 0, punches: ['09:00'] }, SETTINGS) === 0);
  check('break of 0 minutes deducts nothing',
    paidHoursForDay(day('2026-08-03', '09:00', '18:00'), { ...SETTINGS, breakMinutes: 0 }) === 9);
}

section('Punching out for lunch — the real gap is used, not an estimate');
{
  // In 9:00, out for lunch 13:00, back 14:00, home 18:00 => 4 + 4 = 8 paid hours.
  check('four punches pay the two worked halves and exclude lunch',
    paidHoursForDay(day('2026-08-03', '09:00', '13:00', '14:00', '18:00'), SETTINGS) === 8,
    String(paidHoursForDay(day('2026-08-03', '09:00', '13:00', '14:00', '18:00'), SETTINGS)));

  // A 2-hour lunch really costs them 2 hours, not the configured 1.
  check('a long lunch is deducted in full, not at the fixed rate',
    paidHoursForDay(day('2026-08-03', '09:00', '13:00', '15:00', '18:00'), SETTINGS) === 7,
    String(paidHoursForDay(day('2026-08-03', '09:00', '13:00', '15:00', '18:00'), SETTINGS)));

  // A 20-minute lunch is only 20 minutes, not a whole hour.
  check('a short lunch is not over-deducted',
    paidHoursForDay(day('2026-08-03', '09:00', '13:00', '13:20', '18:00'), SETTINGS) === 8.67,
    String(paidHoursForDay(day('2026-08-03', '09:00', '13:00', '13:20', '18:00'), SETTINGS)));

  // Went to lunch and never came back / forgot the evening punch.
  check('an unpaired last punch is not guessed at',
    paidHoursForDay(day('2026-08-03', '09:00', '13:00', '14:00'), SETTINGS) === 4,
    String(paidHoursForDay(day('2026-08-03', '09:00', '13:00', '14:00'), SETTINGS)));

  check('the fixed break is NOT also deducted when lunch was punched',
    paidHoursForDay(day('2026-08-03', '09:00', '13:00', '14:00', '18:00'), SETTINGS) !== 7);
}

/* --------------------------------------------------------------- working days */

section('Working days');
{
  // August 2026: 1st is a Saturday, 31 days, 5 Sundays.
  check('August 2026 has 26 working days with Sunday off',
    countWorkingDays('2026-08-01', '2026-08-31', [0]) === 26,
    String(countWorkingDays('2026-08-01', '2026-08-31', [0])));
  check('closing Sunday AND Saturday gives 21',
    countWorkingDays('2026-08-01', '2026-08-31', [0, 6]) === 21,
    String(countWorkingDays('2026-08-01', '2026-08-31', [0, 6])));
}

/* ------------------------------------------------- the shop owner's example */

section("₹10,000/month, 8h days — the owner's worked example");
{
  // 26 working days x 8 hrs = 208 hrs. 10000/208 = ₹48.08/hr.
  const full = Array.from({ length: 26 }, (_, i) =>
    day(`2026-08-${String(i + 1).padStart(2, '0')}`, '09:00', '18:00'));

  const r = calculateSalary(monthly(10000), full, '2026-08-01', '2026-08-31', SETTINGS);
  check('expected hours = 208', r.expectedHours === 208, String(r.expectedHours));
  check('hourly rate ≈ ₹48.08', r.hourlyRate === 48.08, String(r.hourlyRate));
  check('a full month pays the full ₹10,000', r.amount === 10000, String(r.amount));
  check('paid hours = 208 (break already deducted)', r.paidHours === 208, String(r.paidHours));
}

section('Arriving late, then working extra to make it up');
{
  // 25 normal days, plus one where they came in 2 hours late and stayed 2 hours later.
  const records = [
    ...Array.from({ length: 25 }, (_, i) =>
      day(`2026-08-${String(i + 1).padStart(2, '0')}`, '09:00', '18:00')),
    day('2026-08-26', '11:00', '20:00'), // late in, late out — still 8 paid hours
  ];
  const r = calculateSalary(monthly(10000), records, '2026-08-01', '2026-08-31', SETTINGS);
  check('they still earn the full ₹10,000', r.amount === 10000, String(r.amount));
  check('because the hours are the same, not the clock times', r.paidHours === 208, String(r.paidHours));
}

section('Leaving early without making it up');
{
  // 25 full days + one 4-hour day. 25*8 + 3 = 203 paid hours.
  const records = [
    ...Array.from({ length: 25 }, (_, i) =>
      day(`2026-08-${String(i + 1).padStart(2, '0')}`, '09:00', '18:00')),
    day('2026-08-26', '09:00', '13:00'),
  ];
  const r = calculateSalary(monthly(10000), records, '2026-08-01', '2026-08-31', SETTINGS);
  check('paid hours drop to 203', r.paidHours === 203, String(r.paidHours));
  check('pay is docked proportionally, not by a whole day',
    r.amount === 9759.62, String(r.amount));
  check('which is less than the full salary', r.amount < 10000);
}

section('Overtime — paid at the same hourly rate');
{
  // Every day 9:00-22:00 = 12 paid hours x 26 days = 312 hrs against 208 expected.
  const records = Array.from({ length: 26 }, (_, i) =>
    day(`2026-08-${String(i + 1).padStart(2, '0')}`, '09:00', '22:00'));
  const r = calculateSalary(monthly(10000), records, '2026-08-01', '2026-08-31', SETTINGS);

  check('paid hours are 312', r.paidHours === 312, String(r.paidHours));
  check('104 of them are overtime', r.overtimeHours === 104, String(r.overtimeHours));
  check('overtime is paid at the normal rate, not discarded',
    r.amount === 15000, String(r.amount));
  check('and the overtime portion is broken out',
    r.overtimePay === 5000, String(r.overtimePay));
  check('a normal month reports no overtime',
    calculateSalary(monthly(10000),
      Array.from({ length: 26 }, (_, i) => day(`2026-08-${String(i + 1).padStart(2, '0')}`, '09:00', '18:00')),
      '2026-08-01', '2026-08-31', SETTINGS).overtimeHours === 0);
}

section('Absence');
{
  const records = Array.from({ length: 13 }, (_, i) =>
    day(`2026-08-${String(i + 1).padStart(2, '0')}`, '09:00', '18:00'));
  const r = calculateSalary(monthly(10000), records, '2026-08-01', '2026-08-31', SETTINGS);
  check('half a month worked pays half', r.amount === 5000, String(r.amount));
  check('an employee with no records at all earns nothing',
    calculateSalary(monthly(10000), [], '2026-08-01', '2026-08-31', SETTINGS).amount === 0);
}

section('The other pay bases still work');
{
  const records = [day('2026-08-03', '09:00', '18:00'), day('2026-08-04', '09:00', '18:00')];
  const hourly = { ...monthly(100), salaryMode: 'hourly' } as AttendanceEmployee;
  check('hourly pays the rate x paid hours (break deducted)',
    calculateSalary(hourly, records, '2026-08-01', '2026-08-31', SETTINGS).amount === 1600,
    String(calculateSalary(hourly, records, '2026-08-01', '2026-08-31', SETTINGS).amount));

  const daily = { ...monthly(500), salaryMode: 'daily' } as AttendanceEmployee;
  check('daily pays the rate x days present, whatever the hours',
    calculateSalary(daily, records, '2026-08-01', '2026-08-31', SETTINGS).amount === 1000);

  const unset = { ...monthly(0), salaryMode: null } as AttendanceEmployee;
  const r = calculateSalary(unset, records, '2026-08-01', '2026-08-31', SETTINGS);
  check('an employee with no pay set earns 0 and is flagged', r.amount === 0 && r.needsSetup);
}

console.log(`\n${'─'.repeat(60)}`);
if (failures.length === 0) {
  console.log(`\x1b[32m✓ All ${passed} checks passed.\x1b[0m The salary maths is correct.`);
  process.exit(0);
} else {
  console.log(`\x1b[31m✗ ${failures.length} of ${passed + failures.length} FAILED:\x1b[0m\n`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
