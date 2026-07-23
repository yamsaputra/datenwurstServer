// Time-based, day-boundary hold-out split. Replaces `validationSplit: 0.1`,
// which gave 71 train / 8 validation windows on the pilot data -- 8 windows
// is about 4 hours of a single afternoon, far too small to support any
// decision, and adjacent windows share up to 23 of 24 timesteps (boundary
// leakage) even before considering the split was too small to matter.
//
// Splits on whole local calendar days (never mid-day), holds out the final
// `holdoutFraction` of distinct days, and removes a gap of `maxLagSteps`
// slots between the end of training and the start of the hold-out so that
// no hold-out row's lag features (up to lag-336) can reach back into
// training data.

const SLOT_MS = 30 * 60 * 1000;

export class InsufficientHoldoutError extends Error {
  constructor(actualDays, minDays) {
    super(`Hold-out spans only ${actualDays} distinct day(s), need at least ${minDays} -- refusing to evaluate on too small a sample.`);
    this.name = 'InsufficientHoldoutError';
    this.actualDays = actualDays;
    this.minDays = minDays;
  }
}

const berlinDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' });
function localDateYMD(date) {
  return berlinDateFormatter.format(date); // en-CA gives YYYY-MM-DD directly
}

/**
 * @param {Array<{interval_start: string|Date}>} rows ordered ascending by interval_start
 * @param {object} opts
 * @param {number} opts.holdoutFraction default 0.2
 * @param {number} opts.maxLagSteps default 336 (lag-336 = 7 days)
 * @param {number} opts.minHoldoutDays default 7
 * @returns {{trainingRows: Array, holdoutRows: Array, holdoutDays: string[]}}
 */
export function splitByDayBoundary(rows, { holdoutFraction = 0.2, maxLagSteps = 336, minHoldoutDays = 7 } = {}) {
  const distinctDates = [...new Set(rows.map(r => localDateYMD(new Date(r.interval_start))))].sort();
  const numHoldoutDays = Math.max(1, Math.round(distinctDates.length * holdoutFraction));
  const holdoutStartDate = distinctDates[distinctDates.length - numHoldoutDays];

  const holdoutRows = rows.filter(r => localDateYMD(new Date(r.interval_start)) >= holdoutStartDate);
  const holdoutStartTime = holdoutRows.length ? new Date(holdoutRows[0].interval_start).getTime() : Infinity;
  const gapCutoffTime = holdoutStartTime - maxLagSteps * SLOT_MS;

  const trainingRows = rows.filter(r => new Date(r.interval_start).getTime() < gapCutoffTime);

  const holdoutDays = [...new Set(holdoutRows.map(r => localDateYMD(new Date(r.interval_start))))].sort();
  if (holdoutDays.length < minHoldoutDays) {
    throw new InsufficientHoldoutError(holdoutDays.length, minHoldoutDays);
  }

  return { trainingRows, holdoutRows, holdoutDays };
}
