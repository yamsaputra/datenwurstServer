import { Router } from 'express';
import { createHash } from 'crypto';
import pool from '../db.js';
import apiKeyAuth from '../middleware/apiKeyAuth.js';
import { ingestLimiter } from '../middleware/rateLimiter.js';
import { validateIngestBody } from '../middleware/validate.js';
import { upsertInterval } from '../services/occupancy.js';

const router = Router();

router.post('/jetson/occupancy', ingestLimiter, apiKeyAuth, async (req, res, next) => {
  try {
    const body = req.body;
    const errors = validateIngestBody(body);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });

    const payload_hash = createHash('sha256')
      .update(JSON.stringify({
        device_id:  body.device_id,
        event_time: body.event_time,
        entries:    body.entries,
        exits:      body.exits,
      }))
      .digest('hex');

    const result = await pool.query(`
      INSERT INTO raw_events (device_id, event_time, entries, exits, payload_hash)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (device_id, payload_hash) DO NOTHING
      RETURNING id
    `, [body.device_id, body.event_time, body.entries, body.exits, payload_hash]);

    if (result.rowCount > 0) {
      await upsertInterval(body.event_time, body.entries, body.exits);
    }

    res.json({ received: true, duplicate: result.rowCount === 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
