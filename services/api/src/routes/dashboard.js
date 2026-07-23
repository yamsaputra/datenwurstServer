import { Router } from 'express';
import pool from '../db.js';
import jwtAuth from '../middleware/jwtAuth.js';
import { validateConfigBody } from '../middleware/validate.js';
import { getCurrentOccupancy } from '../services/occupancy.js';
import { getForecastsHours, getForecastsWeek, getHistory } from '../services/forecast.js';
import { getConfig, getConfigValue, setConfigValue } from '../services/config.js';
import { getActiveForecastState } from '../services/forecastState.js';

const router = Router();
router.use(jwtAuth);

router.get('/occupancy/current', async (req, res, next) => {
  try {
    const [occupancy, maxOcc] = await Promise.all([
      getCurrentOccupancy(),
      getConfigValue('max_occupancy'),
    ]);
    const max_occupancy = Number(maxOcc) || 150;
    res.json({
      occupancy,
      max_occupancy,
      percent: Math.min(100, Math.round((occupancy / max_occupancy) * 100)),
      timestamp: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

router.get('/occupancy/history', async (req, res, next) => {
  try {
    const to   = req.query.to   ? new Date(req.query.to)   : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(to - 30 * 24 * 60 * 60 * 1000);
    if (isNaN(from) || isNaN(to)) return res.status(400).json({ error: 'Invalid date range' });
    res.json(await getHistory(from, to));
  } catch (err) { next(err); }
});

router.get('/forecasts/hours', async (req, res, next) => {
  try { res.json(await getForecastsHours(16)); }
  catch (err) { next(err); }
});

router.get('/forecasts/week', async (req, res, next) => {
  try { res.json(await getForecastsWeek()); }
  catch (err) { next(err); }
});

router.get('/forecasts/meta', async (req, res, next) => {
  try {
    const [state, minDaysRecommended, readinessCheck] = await Promise.all([
      getActiveForecastState(),
      getConfigValue('ml.min_training_days_recommended'),
      getConfigValue('ml.last_readiness_check'),
    ]);
    const { rows } = await pool.query(`
      SELECT COUNT(*)::int          AS upcoming_intervals,
             MAX(f.target_interval) AS horizon,
             MAX(f.generated_at)    AS generated_at
      FROM forecasts f
      WHERE f.target_interval >= NOW() AND f.source = $1
    `, [state.active_source === 'collecting_data' ? 'lstm' : state.active_source]);
    res.json({
      ...rows[0],
      ...state,
      min_training_days_recommended: Number(minDaysRecommended) || 182,
      // Cached by checkTrainingReadiness.js (daily) -- never computed live
      // here, since a real check is a full table scan + window-count pass
      // that would scale badly if triggered on every dashboard poll.
      training_ready: readinessCheck?.ready ?? false,
      valid_windows: readinessCheck?.validWindows ?? null,
      min_training_windows: readinessCheck?.minTrainingWindows ?? null,
    });
  } catch (err) { next(err); }
});

// Model registry, including skipped/rejected runs -- the promotion gate
// (trainModel.js) writes a row every time, not just on success, so this is
// where "six consecutive models never beat a constant, all deployed anyway"
// becomes visible and preventable going forward.
router.get('/models', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, created_at, status, train_from, train_to, epochs,
             valid_windows, holdout_mae, baseline_mae, skip_reason, feature_count, is_active
      FROM model_versions ORDER BY created_at DESC LIMIT 20
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/config', async (req, res, next) => {
  try { res.json(await getConfig()); }
  catch (err) { next(err); }
});

router.put('/config', async (req, res, next) => {
  try {
    const errors = validateConfigBody(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    await setConfigValue(req.body.key, req.body.value);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/ingest/status', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT device_id, event_time, entries, exits, received_at
      FROM raw_events ORDER BY received_at DESC LIMIT 10
    `);
    const count = await pool.query('SELECT COUNT(*) FROM raw_events');
    res.json({ recent: rows, total: Number(count.rows[0].count) });
  } catch (err) { next(err); }
});

export default router;
