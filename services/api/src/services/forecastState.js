import pool from '../db.js';
import { getActiveSensorConfigId, NoActiveSensorConfigError } from './sensorConfig.js';

// Staleness threshold from Phase 6.3: predict.js (ml service) refuses to
// generate/write a forecast whose seed data is more than 2 hours old, so if
// ingestion/aggregation has stalled, no row this fresh will exist -- which is
// exactly the signal used here to fall through to the next source rather
// than serve a forecast computed from garbage-old data.
const STALENESS_MS = 2 * 60 * 60 * 1000;

async function dataDaysAvailable(sensorConfigId) {
  const { rows } = await pool.query(`
    SELECT count(DISTINCT (interval_start AT TIME ZONE 'Europe/Berlin')::date) AS days
    FROM occupancy_intervals
    WHERE is_finalized = TRUE AND data_status = 'observed' AND sensor_config_id = $1
  `, [sensorConfigId]);
  return Number(rows[0].days);
}

/**
 * The three-state serving cascade (Phase 6.2). Reflects what is actually
 * being served right now -- a fresh, non-stale `forecasts` row -- rather
 * than independently re-deriving "is the LSTM eligible" from model_versions,
 * which would require duplicating knowledge (the live FEATURES constant)
 * that only the ml service actually has. predict.js is the sole place that
 * decides LSTM-vs-baseline-vs-nothing at generation time; this just reports
 * which of those outcomes is currently on the table.
 *
 * @returns {Promise<{active_source: 'lstm'|'baseline'|'collecting_data', data_days_available: number, forecast_horizon_hours?: number}>}
 */
export async function getActiveForecastState() {
  let sensorConfigId;
  try {
    sensorConfigId = await getActiveSensorConfigId();
  } catch (err) {
    // No sensor has ever been activated (a fresh deployment, or between the
    // pilot's removal and the post-remount activateSensorConfig.js run) --
    // there is by definition no data and nothing to serve, not an error.
    if (err instanceof NoActiveSensorConfigError) {
      return { active_source: 'collecting_data', data_days_available: 0 };
    }
    throw err;
  }

  const freshCutoff = new Date(Date.now() - STALENESS_MS);

  const { rows: lstmRows } = await pool.query(`
    SELECT 1 FROM forecasts
    WHERE source = 'lstm' AND generated_at >= $1 AND target_interval >= NOW()
    LIMIT 1
  `, [freshCutoff]);
  if (lstmRows.length) {
    return { active_source: 'lstm', data_days_available: await dataDaysAvailable(sensorConfigId), forecast_horizon_hours: 12 };
  }

  const { rows: baselineRows } = await pool.query(`
    SELECT 1 FROM forecasts
    WHERE source = 'baseline' AND generated_at >= $1 AND target_interval >= NOW()
    LIMIT 1
  `, [freshCutoff]);
  if (baselineRows.length) {
    return { active_source: 'baseline', data_days_available: await dataDaysAvailable(sensorConfigId), forecast_horizon_hours: 168 };
  }

  return { active_source: 'collecting_data', data_days_available: await dataDaysAvailable(sensorConfigId) };
}
