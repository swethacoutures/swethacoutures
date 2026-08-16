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
  /** Left off SETTINGS below on purpose, so the defaults are exercised too. */
  minPunchGapMinutes?: number;
  minBreakMinutes?: number;
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

section('Pressing the finger several times by mistake');
{
  /*
   * The two questions the shop actually asked. Both are answered here rather than in prose,
   * so the answers cannot quietly stop being true.
   */

  // Somebody jabs the sensor four times in ten seconds on the way in, then leaves at six.
  check(
    'four presses in a few seconds count as one arrival',
    paidHoursForDay(day('2026-08-03', '09:00', '09:00', '09:00', '09:01', '18:00'), SETTINGS) === 8,
    String(paidHoursForDay(day('2026-08-03', '09:00', '09:00', '09:00', '09:01', '18:00'), SETTINGS)));

  // The same thing on the way out.
  check(
    'repeated presses on the way out do not shorten the day',
    paidHoursForDay(day('2026-08-03', '09:00', '18:00', '18:00', '18:02'), SETTINGS) === 8,
    String(paidHoursForDay(day('2026-08-03', '09:00', '18:00', '18:00', '18:02'), SETTINGS)));

  // The real record from this shop: 16 presses between 17:47 and 19:27, one evening.
  const jabbed = paidHoursForDay(
    day('2026-08-10', '17:47', '17:48', '17:53', '17:57', '18:19', '18:20', '18:21', '18:30',
        '18:34', '18:39', '18:44', '18:52', '18:53', '19:02', '19:20', '19:27'),
    SETTINGS);
  check(
    'a real 16-press evening is not shredded into minutes',
    jabbed > 1, `got ${jabbed} h from a 1h40 evening`);
}

section('Arriving, then leaving again shortly after');
{
  // In at 09:00, back out at 09:08, gone for the morning, back at 14:00 until 18:00.
  const inOutBack = paidHoursForDay(
    day('2026-08-03', '09:00', '09:08', '14:00', '18:00'), SETTINGS);
  check(
    'the hours away are not paid',
    inOutBack === 4.13, String(inOutBack));

  // In at 09:00 and gone for the day at 09:08 — a wasted trip, paid as the 8 minutes it was.
  const shortVisit = paidHoursForDay(day('2026-08-03', '09:00', '09:08'), SETTINGS);
  check(
    'a visit shorter than the break is paid as itself, never negative',
    shortVisit === 0.13, String(shortVisit));

  /*
   * Stepping out for three minutes is not a lunch break. Collapsing that pair leaves three
   * punches — an odd count — so the day falls back to "time on the premises less the
   * standard break", which is exactly the rule for a day where nobody punched out for
   * lunch. 8h, not the 3h the old parity reading produced.
   */
  check(
    'a three-minute step outside does not cost the afternoon',
    paidHoursForDay(day('2026-08-03', '09:00', '12:00', '12:03', '18:00'), SETTINGS) === 8,
    String(paidHoursForDay(day('2026-08-03', '09:00', '12:00', '12:03', '18:00'), SETTINGS)));

  // Punched in and never out: nothing is guessed, the day reads zero until corrected.
  check(
    'forgetting to punch out pays nothing until an admin fixes the day',
    paidHoursForDay({ checkIn: '09:00', checkOut: '', hoursWorked: 0, punches: ['09:00'] }, SETTINGS) === 0);

  // An admin correction overrides the punches completely.
  check(
    "an admin's corrected times win over the raw punches",
    paidHoursForDay(
      { checkIn: '09:00', checkOut: '18:00', hoursWorked: 9, manuallyEdited: true,
        punches: ['09:00', '09:08'] },
      SETTINGS) === 8,
    String(paidHoursForDay(
      { checkIn: '09:00', checkOut: '18:00', hoursWorked: 9, manuallyEdited: true,
        punches: ['09:00', '09:08'] }, SETTINGS)));
}

section('The admin can override a day outright');
{
  // The escape hatch: whatever the machine says, this day pays what the admin says.
  check(
    'an override beats the punches',
    paidHoursForDay(
      { checkIn: '09:00', checkOut: '09:08', hoursWorked: 0.13,
        punches: ['09:00', '09:08'], overrideHours: 8 },
      SETTINGS) === 8);

  check(
    'an override beats a manual time correction too',
    paidHoursForDay(
      { checkIn: '09:00', checkOut: '18:00', hoursWorked: 9,
        manuallyEdited: true, overrideHours: 4 },
      SETTINGS) === 4);

  // Zero is a real decision, not "no override" — a day deliberately paid nothing.
  check(
    'an override of zero pays nothing, and is not mistaken for unset',
    paidHoursForDay(
      { checkIn: '09:00', checkOut: '18:00', hoursWorked: 9, overrideHours: 0 },
      SETTINGS) === 0);

  check(
    'a negative override cannot pay a negative day',
    paidHoursForDay(
      { checkIn: '09:00', checkOut: '18:00', hoursWorked: 9, overrideHours: -5 },
      SETTINGS) === 0);

  check(
    'no override means the normal rules still apply',
    paidHoursForDay(day('2026-08-03', '09:00', '18:00'), SETTINGS) === 8);
}

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

/* ------------------------------------------------- repeat presses & short gaps */

section('Repeat presses on the sensor');
{
  // Straight from the shop's own data, 10 Aug 2026, employee 2: sixteen punches between
  // 17:47 and 19:27. Nobody left and came back eight times — they pressed repeatedly.
  const real = day(
    '2026-08-10',
    '17:47', '17:48', '17:53', '17:57', '18:19', '18:20', '18:21', '18:30',
    '18:34', '18:39', '18:44', '18:52', '18:53', '19:02', '19:20', '19:27'
  );
  const paid = paidHoursForDay(real, SETTINGS);

  // The old pairing rule read this as eight tiny shifts and paid about 0.3 hours for a
  // 1h40 evening. Anything close to the real span is the point of the fix.
  check('a real 16-punch evening is not shredded into minutes', paid > 1, String(paid));
  check('and never pays more than the time actually on the premises', paid <= 1.67, String(paid));

  check('two presses one minute apart count once',
    paidHoursForDay(day('2026-08-03', '09:00', '09:01', '18:00'), SETTINGS) === 8,
    String(paidHoursForDay(day('2026-08-03', '09:00', '09:01', '18:00'), SETTINGS)));

  /*
   * With the window off, the stray 09:01 press is kept, the count stays even, and the
   * pairing reads 09:01→13:00 as time away — the whole morning lost. That is precisely what
   * the window exists to prevent.
   */
  const withWindow = paidHoursForDay(
    day('2026-08-03', '09:00', '09:01', '13:00', '18:00'), SETTINGS);
  const withoutWindow = paidHoursForDay(
    day('2026-08-03', '09:00', '09:01', '13:00', '18:00'),
    { ...SETTINGS, minPunchGapMinutes: 0 });
  check('de-duplication respects the configured window',
    withWindow === 8 && withoutWindow < 6,
    `with ${withWindow}, without ${withoutWindow}`);
}

section('Short absences stay paid, real breaks do not');
{
  // Stepped out for five minutes mid-morning: not a lunch break.
  check('a 5-minute step outside is still paid',
    paidHoursForDay(day('2026-08-03', '09:00', '11:00', '11:05', '18:00'), SETTINGS) === 9,
    String(paidHoursForDay(day('2026-08-03', '09:00', '11:00', '11:05', '18:00'), SETTINGS)));

  // Exactly at the threshold — 20 minutes counts as a break.
  check('a 20-minute absence is on the break side of the line',
    paidHoursForDay(day('2026-08-03', '09:00', '11:00', '11:20', '18:00'), SETTINGS) === 8.67,
    String(paidHoursForDay(day('2026-08-03', '09:00', '11:00', '11:20', '18:00'), SETTINGS)));

  check('the threshold is configurable',
    paidHoursForDay(day('2026-08-03', '09:00', '11:00', '11:05', '18:00'),
      { ...SETTINGS, minPunchGapMinutes: 1, minBreakMinutes: 5 }) === 8.92,
    String(paidHoursForDay(day('2026-08-03', '09:00', '11:00', '11:05', '18:00'),
      { ...SETTINGS, minPunchGapMinutes: 1, minBreakMinutes: 5 })));
}

section("A hand correction beats the device's punches");
{
  /**
   * The record keeps its original punches when an admin corrects the times — the write
   * merges. Reading punches first meant the correction showed in the table and changed
   * nothing on the payslip, which is the worst of both.
   */
  const corrected = {
    ...day('2026-08-03', '09:00', '13:00', '14:00', '18:00'),
    checkIn: '09:00',
    checkOut: '19:00',
    hoursWorked: 10,
    manuallyEdited: true,
  } as AttendanceRecord;

  check('the corrected times are used, not the stale punch array',
    paidHoursForDay(corrected, SETTINGS) === 9,
    String(paidHoursForDay(corrected, SETTINGS)));

  check('and the same record without the flag still reads its punches',
    paidHoursForDay({ ...corrected, manuallyEdited: false }, SETTINGS) === 8,
    String(paidHoursForDay({ ...corrected, manuallyEdited: false }, SETTINGS)));

  const salary = calculateSalary(monthly(10000), [corrected], '2026-08-01', '2026-08-31', SETTINGS);
  check('and the correction reaches the payslip',
    salary.paidHours === 9, String(salary.paidHours));
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
