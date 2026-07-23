import db from '../lib/db.js';
import { nowIso } from '../lib/logger.js';

export default async function cleanup() {
  try {
    const { rowCount } = await db.query(
      "DELETE FROM raw_events WHERE event_time < NOW() - INTERVAL '6 months'"
    );
    // Scoped to source='forecast' only: historical rows (source='historical')
    // are the backfilled record used for training and must never be purged
    // by this daily prune, however old they get -- an unscoped delete here
    // would silently erase Phase 4's historical weather backfill every
    // night once it reached back further than 10 days.
    const { rowCount: wc } = await db.query(
      "DELETE FROM weather_cache WHERE source = 'forecast' AND forecast_for < NOW()::DATE - 10"
    );
    console.log(`[cleanup][${nowIso()}] Deleted ${rowCount} old events, ${wc} old weather rows`);
  } catch (err) {
    console.error(`[cleanup][${nowIso()}] Failed:`, err.message);
  }
}
