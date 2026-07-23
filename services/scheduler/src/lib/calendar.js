// Calendar-derived opening hours: the single resolver every service uses to
// decide is_open/period_type for a given local calendar date. This replaces
// the config-table-driven opening_hours/semester_breaks, which had no
// mechanism to ever flip is_open away from its stuck TRUE default.
//
// resolveDay() is a pure function (no DB, no network) so it can be unit
// tested directly against the exact worked examples in the correctness-
// overhaul plan -- callers (aggregateIntervals.js, backfillIsOpen.js) are
// responsible for loading calendar_periods/calendar_lecture_free rows and
// resolving holiday status beforehand.

export class UnconfiguredCalendarRangeError extends Error {
  constructor(dateLocalYMD) {
    super(`No calendar_periods row covers ${dateLocalYMD} -- refusing to silently default. Add a period covering this date.`);
    this.name = 'UnconfiguredCalendarRangeError';
    this.dateLocalYMD = dateLocalYMD;
  }
}

const TIME_ZONE = 'Europe/Berlin';

/**
 * @param {string} dateLocalYMD  'YYYY-MM-DD', the LOCAL calendar date to resolve
 * @param {object} opts
 * @param {Array}  opts.periods      rows from calendarRepo.loadPeriods()
 * @param {Array}  opts.lectureFree  rows from calendarRepo.loadLectureFree()
 * @param {boolean} opts.isHoliday   whether dateLocalYMD is a DE-BB public holiday
 *                                   (resolved by the caller via holidays.js -- kept
 *                                   out of this function so it stays synchronous/pure)
 * @returns {{is_open: boolean, period_type: 'lecture'|'exam'|'break', opens_local: string|null, closes_local: string|null, rule: 1|2|3|4}}
 */
export function resolveDay(dateLocalYMD, { periods, lectureFree, isHoliday }) {
  const period = pickPeriod(dateLocalYMD, periods);
  if (!period) throw new UnconfiguredCalendarRangeError(dateLocalYMD);

  // Holiday is checked ahead of the weekend check (even though the cascade
  // is described as "1. weekend, 2. holiday") because a holiday that also
  // falls on a weekend must still be reported as closed *via rule 2*, not
  // rule 1 -- otherwise a broken Nager.Date subdivision filter (returning
  // false for every real holiday) would go completely undetected on any
  // holiday that happens to land on a Saturday or Sunday, since rule 1 alone
  // would still close the day and mask the regression. See calendar.test.js.
  if (isHoliday) {
    return closed(period.period_type, 2);
  }
  if (isWeekend(dateLocalYMD)) {
    return closed(period.period_type, 1);
  }
  if (period.period_type === 'lecture' && inAnyRange(dateLocalYMD, lectureFree)) {
    return { is_open: true, period_type: 'lecture', opens_local: '10:00', closes_local: '17:00', rule: 3 };
  }
  return {
    is_open: true,
    period_type: period.period_type,
    opens_local: period.opens_local.slice(0, 5),
    closes_local: period.closes_local.slice(0, 5),
    rule: 4,
  };
}

function closed(period_type, rule) {
  return { is_open: false, period_type, opens_local: null, closes_local: null, rule };
}

function pickPeriod(dateLocalYMD, periods) {
  let best = null;
  for (const p of periods) {
    if (dateLocalYMD >= p.start_date && dateLocalYMD <= p.end_date) {
      if (!best || p.specificity > best.specificity) best = p;
    }
  }
  return best;
}

function inAnyRange(dateLocalYMD, ranges) {
  return ranges.some(r => dateLocalYMD >= r.start_date && dateLocalYMD <= r.end_date);
}

function isWeekend(dateLocalYMD) {
  // A plain calendar date has no timezone component to get wrong -- parsing
  // it as UTC midnight is safe here because we only ever ask "what weekday
  // is this", never converting a specific clock time between zones.
  const day = new Date(`${dateLocalYMD}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return day === 0 || day === 6;
}

/**
 * Offset (in minutes, UTC minus local) of `timeZone` at the instant `date`
 * represents. Positive for zones ahead of UTC (Berlin: +60 in winter, +120
 * in summer/CEST).
 */
function tzOffsetMinutes(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map(x => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUTC - date.getTime()) / 60000;
}

/**
 * Converts a LOCAL wall-clock date+time in Europe/Berlin to the UTC instant
 * it represents. Never uses Date#getHours()/setHours() (those read/write in
 * the *process's* local timezone, which is a container config detail, not
 * Europe/Berlin) -- this does explicit IANA-zone conversion instead.
 *
 * @param {string} dateLocalYMD 'YYYY-MM-DD'
 * @param {string} timeLocalHHMM 'HH:MM'
 * @returns {Date}
 */
export function localToUtc(dateLocalYMD, timeLocalHHMM) {
  const [y, m, d] = dateLocalYMD.split('-').map(Number);
  const [hh, mm] = timeLocalHHMM.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offsetMin = tzOffsetMinutes(new Date(guess), TIME_ZONE);
  return new Date(guess - offsetMin * 60000);
}

/**
 * Splits a UTC instant into its Europe/Berlin local calendar date and
 * clock time, for feeding into resolveDay()/inAnyRange() and for the
 * aggregation job's slot-by-slot local-time bookkeeping.
 *
 * @param {Date} utcDate
 * @returns {{dateLocalYMD: string, timeLocalHHMM: string}}
 */
export function utcToLocalParts(utcDate) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(utcDate).map(x => [x.type, x.value]));
  return { dateLocalYMD: `${p.year}-${p.month}-${p.day}`, timeLocalHHMM: `${p.hour}:${p.minute}` };
}
