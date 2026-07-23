// Notifies once when enough contiguous data exists to attempt training --
// a dashboard-visible signal plus an optional outbound webhook, so nobody
// has to keep checking the dashboard manually to know when it's worth
// clicking "Train Model". Fires at most once per readiness "episode":
// ml.readiness_notified is set true here and reset back to false by
// trainModel.js on any subsequent training attempt (skipped/rejected/active
// alike), so a future data change can notify again after that.
//
// Caches its result to config.ml.last_readiness_check on every run so the
// dashboard can display it by reading a config value (cheap) instead of
// triggering a live recomputation on every poll -- checkReadiness() does a
// full table scan and window-count pass over all occupancy data, which
// would scale badly if invoked on every ~10s dashboard poll.
import db from '../lib/db.js';
import { httpGet, httpPost } from '../lib/httpClient.js';
import { nowIso } from '../lib/logger.js';

const ML_URL    = process.env.ML_SERVICE_URL || 'http://ml:3002';
const ML_SECRET = process.env.ML_SECRET || '';

export default async function checkTrainingReadiness() {
  try {
    const res = await httpGet(`${ML_URL}/training-readiness`, {
      headers: { 'X-ML-Secret': ML_SECRET },
    });
    const { validWindows, minTrainingWindows, ready } = await res.json();

    await db.query(`
      INSERT INTO config (key, value) VALUES ('ml.last_readiness_check', $1)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [JSON.stringify({ validWindows, minTrainingWindows, ready, checkedAt: new Date().toISOString() })]);

    if (!ready) {
      console.log(`[training-readiness][${nowIso()}] Not yet ready: ${validWindows}/${minTrainingWindows} valid windows`);
      return;
    }

    const { rows } = await db.query("SELECT value FROM config WHERE key = 'ml.readiness_notified'");
    const alreadyNotified = rows[0]?.value === true;
    if (alreadyNotified) {
      console.log(`[training-readiness][${nowIso()}] Ready (${validWindows}/${minTrainingWindows} windows) -- already notified, skipping`);
      return;
    }

    console.log(`[training-readiness][${nowIso()}] READY: ${validWindows}/${minTrainingWindows} valid windows -- notifying`);

    const { rows: webhookRows } = await db.query("SELECT value FROM config WHERE key = 'notifications.webhook_url'");
    const webhookUrl = webhookRows[0]?.value;
    if (webhookUrl) {
      try {
        await httpPost(webhookUrl, {
          event: 'training_ready',
          valid_windows: validWindows,
          min_training_windows: minTrainingWindows,
          timestamp: new Date().toISOString(),
        });
        console.log(`[training-readiness][${nowIso()}] Webhook notified successfully`);
      } catch (err) {
        // A failed webhook must never block the dashboard banner (below)
        // from still reflecting readiness, and must never crash the job.
        console.error(`[training-readiness][${nowIso()}] Webhook call failed:`, err.message);
      }
    }

    await db.query(`
      INSERT INTO config (key, value) VALUES ('ml.readiness_notified', 'true')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
  } catch (err) {
    console.error(`[training-readiness][${nowIso()}] Failed:`, err.message);
  }
}
