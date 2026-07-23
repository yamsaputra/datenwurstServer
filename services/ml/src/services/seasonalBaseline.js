// Seasonal-mean baseline: mean occupancy by (weekday, half-hour slot),
// computed only from finalized, observed history for a single sensor
// config. This is a first-class forecast source (writes to `forecasts`
// with source='baseline'), not just an evaluation reference -- it is what
// serves the public API whenever no LSTM is loadable or none has beaten it
// on a holdout set (see forecastState.js), and what backs the 7-day widget
// view even when an LSTM *is* active, since the autoregressive loop's
// output for days 2-7 is fixed-point-converged noise (Phase 6.4).

import pool from '../db.js';
import { getConfigValue } from './config.js';
import { writePredictions } from './predictionWriter.js';

const BASELINE_MODEL_PATH = '__baseline__';
const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const berlinParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin', hourCycle: 'h23',
  weekday: 'short', hour: '2-digit', minute: '2-digit',
});

function localWeekdayHourMinute(utcDate) {
  const p = Object.fromEntries(berlinParts.formatToParts(utcDate).map(x => [x.type, x.value]));
  return { dayOfWeek: WEEKDAY_INDEX[p.weekday], hour: Number(p.hour), minute: Number(p.minute) };
}

async function getBaselineModelVersionId() {
  const { rows } = await pool.query('SELECT id FROM model_versions WHERE model_path = $1', [BASELINE_MODEL_PATH]);
  if (!rows.length) throw new Error(`No model_versions row with model_path='${BASELINE_MODEL_PATH}' -- run db/migrate.sh`);
  return rows[0].id;
}

/**
 * Pure aggregation: mean occupancy by (weekday, half-hour slot) from an
 * in-memory row array. Shared by computeSeasonalProfile() (DB-querying,
 * used for live serving) and trainModel.js (evaluating the seasonal
 * baseline against the exact same hold-out split used for the LSTM, via
 * training-only rows -- never re-deriving its own gate independently, which
 * would let the two disagree about how much history "counts").
 *
 * @param {Array<{day_of_week:number, interval_start:string|Date, occupancy:number|null}>} rows
 * @returns {{forSlot(dow:number,hour:number,minute:number):number}}
 */
export function buildSeasonalProfileFromRows(rows) {
  const bySlot = new Map();
  const byWeekday = new Map();
  let overallSum = 0, overallN = 0;

  for (const r of rows) {
    if (r.occupancy === null || r.occupancy === undefined) continue;
    const { hour, minute } = localHourMinute(new Date(r.interval_start));
    const key = `${r.day_of_week}-${hour}-${minute}`;

    const slot = bySlot.get(key) ?? { sum: 0, n: 0 };
    slot.sum += r.occupancy; slot.n += 1;
    bySlot.set(key, slot);

    const wd = byWeekday.get(r.day_of_week) ?? { sum: 0, n: 0 };
    wd.sum += r.occupancy; wd.n += 1;
    byWeekday.set(r.day_of_week, wd);

    overallSum += r.occupancy; overallN += 1;
  }
  const overallAvg = overallN > 0 ? overallSum / overallN : 0;

  return {
    forSlot(dayOfWeek, hour, minute) {
      const exact = bySlot.get(`${dayOfWeek}-${hour}-${minute}`);
      if (exact && exact.n > 0) return exact.sum / exact.n;
      const wd = byWeekday.get(dayOfWeek);
      if (wd && wd.n > 0) return wd.sum / wd.n;
      return overallAvg;
    },
  };
}

function localHourMinute(utcDate) {
  const p = Object.fromEntries(berlinParts.formatToParts(utcDate).map(x => [x.type, x.value]));
  return { hour: Number(p.hour), minute: Number(p.minute) };
}

/**
 * @param {number} sensorConfigId
 * @returns {{profile: null, daysAvailable: number, minBaselineDays: number} |
 *           {profile: {forSlot(dow:number,hour:number,minute:number):number}, daysAvailable: number, minBaselineDays: number}}
 *          profile is null when daysAvailable < minBaselineDays -- there is
 *          no partial/degraded baseline, only "enough data" or "none".
 */
export async function computeSeasonalProfile(sensorConfigId) {
  const minBaselineDays = Number((await getConfigValue('ml.min_baseline_days')) ?? 14);

  const { rows: coverage } = await pool.query(`
    SELECT count(DISTINCT (interval_start AT TIME ZONE 'Europe/Berlin')::date) AS days
    FROM occupancy_intervals
    WHERE is_finalized = TRUE AND data_status = 'observed' AND sensor_config_id = $1
  `, [sensorConfigId]);
  const daysAvailable = Number(coverage[0].days);

  if (daysAvailable < minBaselineDays) {
    return { profile: null, daysAvailable, minBaselineDays };
  }

  const { rows } = await pool.query(`
    SELECT day_of_week, interval_start, occupancy
    FROM occupancy_intervals
    WHERE is_finalized = TRUE AND data_status = 'observed' AND sensor_config_id = $1
  `, [sensorConfigId]);

  return { daysAvailable, minBaselineDays, profile: buildSeasonalProfileFromRows(rows) };
}

/**
 * Writes a seasonal-baseline forecast starting at the next half-hour
 * boundary after `anchor`. Returns {written: 0, ...} (never throws, never
 * writes a partial/fabricated forecast) when there isn't yet enough history.
 */
export async function generateBaselineForecast({ sensorConfigId, anchor = new Date(), horizonSteps = 336 } = {}) {
  const { profile, daysAvailable, minBaselineDays } = await computeSeasonalProfile(sensorConfigId);
  if (!profile) return { written: 0, daysAvailable, minBaselineDays };

  const modelVersionId = await getBaselineModelVersionId();

  const start = new Date(anchor);
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() < 30 ? 30 : 60);

  const predictions = [];
  for (let i = 0; i < horizonSteps; i++) {
    const target = new Date(start.getTime() + i * 30 * 60 * 1000);
    const { dayOfWeek, hour, minute } = localWeekdayHourMinute(target);
    const predicted_occ = Math.max(0, Math.round(profile.forSlot(dayOfWeek, hour, minute)));
    predictions.push({ target_interval: target.toISOString(), predicted_occ });
  }

  await writePredictions(predictions, modelVersionId, 'baseline');
  return { written: predictions.length, daysAvailable, minBaselineDays };
}
