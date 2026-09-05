/**
 * Periods — a day's punches read as the stretches actually worked.
 *
 * The shop's rule, in the owner's own words:
 *
 *   period 1 = check-in -> check-out
 *   period 2 = check-in -> check-out
 *   the day  = every period added together
 *
 * The device's own IN/OUT flag is deliberately ignored. It is set by whichever mode key
 * the terminal happened to be in — the shop's own data has an evening of presses labelled
 * "Check in", "Check in", "Overtime in" with not one "out" among them. The role of a punch
 * is decided HERE, by its position in the day: first press in, second out, third in again.
 *
 * Everything below exists because two real habits break naive pairing:
 *
 *   1. People press the sensor repeatedly when they are unsure it read. Sixteen presses in
 *      one evening, in this shop's own records. Paired naively that is eight "shifts"
 *      worth twenty minutes, for an evening somebody actually worked.
 *   2. Collapsing those repeats can turn an even count ODD, and then every gap's meaning
 *      flips — a three-minute step outside gets read as an afternoon of absence.
 *
 * The fix for (2) is the `assumed` flag: when the count is odd *because* a repeat press was
 * collapsed, the pairing cannot be trusted and the day is read as one stretch. When the
 * count is odd with no repeats anywhere, a punch is genuinely missing — that is a real
 * check-out the employee forgot, so the complete periods are paid and the day is flagged
 * for the admin rather than guessed at.
 */
import { DEFAULT_ATTENDANCE_SETTINGS, type AttendanceSettings } from './types';

/** What the platform decided a press means. `repeat` = the same event pressed again. */
export type PunchRole = 'in' | 'out' | 'repeat';

export interface WorkPeriod {
  /** 'HH:mm' */
  checkIn: string;
  /** 'HH:mm' */
  checkOut: string;
  minutes: number;
}

export interface DayTimeline {
  /** Every distinct minute punched, in order, with the role the platform assigns it. */
  roles: { time: string; role: PunchRole }[];
  /** The completed periods, after short gaps have been merged away. */
  periods: WorkPeriod[];
  /** A trailing check-in with no check-out. The employee forgot to punch out. */
  openCheckIn?: string;
  /** The periods added together, before any fixed break. */
  workedMinutes: number;
  /** Fixed unpaid break applied because nobody punched out for lunch. */
  breakApplied: number;
  /** workedMinutes less breakApplied. What the day is paid for. */
  paidMinutes: number;
  /**
   * The day had to be read as one stretch because a repeat press left an odd count.
   * The hours are sound; the individual periods are not to be trusted.
   */
  assumed: boolean;
  /** A check-out is missing. Pays the complete periods only, until an admin corrects it. */
  incomplete: boolean;
}

/** Minutes since midnight for 'HH:mm'. Returns NaN for anything unparseable. */
function toMinutes(time: string): number {
  const [hour, minute] = String(time || '').split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return NaN;
  return hour * 60 + minute;
}

/**
 * Groups presses into runs, where a run is one event pressed one or more times.
 *
 * The gap is measured from the previous press in the run, not from the first one, so a
 * finger held on the sensor across four consecutive minutes stays a single arrival instead
 * of splitting the moment the fourth press falls outside the window.
 *
 * A window of 0 puts every press in its own run, which is what makes the setting testable.
 */
function groupRuns(times: string[], windowMinutes: number): string[][] {
  const runs: string[][] = [];
  let current: string[] = [];
  let previous = NaN;

  for (const time of times) {
    const minutes = toMinutes(time);
    if (Number.isNaN(minutes)) continue;

    if (current.length === 0 || minutes - previous < windowMinutes) {
      current.push(time);
    } else {
      runs.push(current);
      current = [time];
    }
    previous = minutes;
  }

  if (current.length > 0) runs.push(current);
  return runs;
}

/** Pairs events into periods: 1st->2nd worked, 2nd->3rd away, 3rd->4th worked. */
function pairIntoPeriods(events: string[]): WorkPeriod[] {
  const periods: WorkPeriod[] = [];
  for (let i = 0; i + 1 < events.length; i += 2) {
    periods.push({
      checkIn: events[i],
      checkOut: events[i + 1],
      minutes: Math.max(0, toMinutes(events[i + 1]) - toMinutes(events[i])),
    });
  }
  return periods;
}

/**
 * Joins periods separated by less than `minBreakMinutes`.
 *
 * Stepping outside for five minutes is not a lunch break, and docking it would make the
 * machine meaner than any human supervisor. At or above the threshold the absence is real
 * and comes off in full — a two-hour lunch costs two hours, not the configured one.
 */
function mergeShortGaps(periods: WorkPeriod[], minBreakMinutes: number): WorkPeriod[] {
  if (periods.length < 2) return periods;

  const merged: WorkPeriod[] = [{ ...periods[0] }];

  for (const period of periods.slice(1)) {
    const last = merged[merged.length - 1];
    const gap = toMinutes(period.checkIn) - toMinutes(last.checkOut);

    if (gap < minBreakMinutes) {
      last.checkOut = period.checkOut;
      last.minutes = Math.max(0, toMinutes(last.checkOut) - toMinutes(last.checkIn));
    } else {
      merged.push({ ...period });
    }
  }

  return merged;
}

/**
 * Reads one day's punches as periods.
 *
 * `punches` are the 'HH:mm' times stored on the day record — every press the device sent,
 * in any order. Duplicated minutes are harmless; they collapse with everything else.
 */
export function buildDayTimeline(
  punches: string[],
  settings: AttendanceSettings = DEFAULT_ATTENDANCE_SETTINGS
): DayTimeline {
  const window = Math.max(
    0,
    settings.minPunchGapMinutes ?? DEFAULT_ATTENDANCE_SETTINGS.minPunchGapMinutes
  );
  const minBreak = Math.max(
    0,
    settings.minBreakMinutes ?? DEFAULT_ATTENDANCE_SETTINGS.minBreakMinutes
  );
  const fixedBreak = Math.max(
    0,
    settings.breakMinutes ?? DEFAULT_ATTENDANCE_SETTINGS.breakMinutes
  );

  const times = [...new Set((punches || []).filter(Boolean))]
    .filter((time) => !Number.isNaN(toMinutes(time)))
    .sort();

  const empty: DayTimeline = {
    roles: [],
    periods: [],
    workedMinutes: 0,
    breakApplied: 0,
    paidMinutes: 0,
    assumed: false,
    incomplete: false,
  };

  if (times.length === 0) return empty;

  const runs = groupRuns(times, window);
  const events = runs.map((run) => run[0]);
  const hadRepeats = runs.some((run) => run.length > 1);

  const roles: { time: string; role: PunchRole }[] = [];
  let periods: WorkPeriod[] = [];
  let openCheckIn: string | undefined;
  let assumed = false;
  let incomplete = false;

  if (events.length === 1) {
    // Punched in and never out. Nothing is guessed — the day pays nothing until corrected.
    incomplete = true;
    openCheckIn = events[0];
    for (const run of runs) {
      run.forEach((time, index) => roles.push({ time, role: index === 0 ? 'in' : 'repeat' }));
    }
  } else if (events.length % 2 === 0) {
    periods = pairIntoPeriods(events);
    runs.forEach((run, runIndex) => {
      const role: PunchRole = runIndex % 2 === 0 ? 'in' : 'out';
      run.forEach((time, index) => roles.push({ time, role: index === 0 ? role : 'repeat' }));
    });
  } else if (hadRepeats) {
    /*
     * Odd only because a repeat press was collapsed. The parity is a lie, so the pairing
     * below it would be too: read the day as one stretch from the first press to the last.
     * This is the case that used to pay three hours for a nine-hour day.
     */
    assumed = true;
    periods = [
      {
        checkIn: events[0],
        checkOut: events[events.length - 1],
        minutes: Math.max(0, toMinutes(events[events.length - 1]) - toMinutes(events[0])),
      },
    ];
    times.forEach((time, index) =>
      roles.push({
        time,
        role: index === 0 ? 'in' : index === times.length - 1 ? 'out' : 'repeat',
      })
    );
  } else {
    /*
     * Odd with no repeats anywhere: a punch is genuinely missing. Pay the complete periods
     * and leave the trailing check-in open for the admin, rather than inventing a
     * check-out nobody pressed.
     */
    incomplete = true;
    periods = pairIntoPeriods(events.slice(0, -1));
    openCheckIn = events[events.length - 1];
    runs.forEach((run, runIndex) => {
      const role: PunchRole = runIndex % 2 === 0 ? 'in' : 'out';
      run.forEach((time, index) => roles.push({ time, role: index === 0 ? role : 'repeat' }));
    });
  }

  periods = mergeShortGaps(periods, minBreak);
  const workedMinutes = periods.reduce((sum, period) => sum + period.minutes, 0);

  /*
   * The fixed break stands in for a lunch nobody punched.
   *
   * It applies only when the day holds no evidence of a break being taken: exactly two
   * presses, or a day whose parity had to be repaired. The moment a third press exists the
   * real absences are visible in the punches and are used instead — deducting both would
   * charge the employee for the same lunch twice.
   */
  const deductFixedBreak = events.length === 2 || assumed;
  const breakApplied = deductFixedBreak && workedMinutes > fixedBreak ? fixedBreak : 0;

  return {
    roles: roles.sort((a, b) => a.time.localeCompare(b.time)),
    periods,
    openCheckIn,
    workedMinutes,
    breakApplied,
    paidMinutes: Math.max(0, workedMinutes - breakApplied),
    assumed,
    incomplete,
  };
}

/**
 * The role of every punched minute, for labelling the raw feed on the Punches tab.
 *
 * Keyed by 'HH:mm', because that is all the day record keeps. Several presses inside the
 * same minute therefore share a label, which is correct — they are the same event.
 */
export function punchRoles(
  punches: string[],
  settings: AttendanceSettings = DEFAULT_ATTENDANCE_SETTINGS
): Map<string, PunchRole> {
  const timeline = buildDayTimeline(punches, settings);
  return new Map(timeline.roles.map((entry) => [entry.time, entry.role]));
}

/** 'HH:mm' -> '2h 05m', for showing a period's length without a decimal. */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, '0')}m`;
}
