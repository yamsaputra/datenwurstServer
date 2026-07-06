import { Router } from 'express';
import pool from '../db.js';
import jwtAuth from '../middleware/jwtAuth.js';
import { validateConfigBody } from '../middleware/validate.js';
import { getCurrentOccupancy } from '../services/occupancy.js';
import { getForecastsHours, getForecastsWeek, getHistory } from '../services/forecast.js';
import { getConfig, getConfigValue, setConfigValue } from '../services/config.js';

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
    const { rows } = await pool.query(`
      SELECT COUNT(*)::int          AS upcoming_intervals,
             MAX(f.target_interval) AS horizon,
             MAX(f.generated_at)    AS generated_at
      FROM forecasts f
      INNER JOIN model_versions mv ON mv.id = f.model_version AND mv.is_active = TRUE
      WHERE f.target_interval >= NOW()
    `);
    res.json(rows[0]);
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
