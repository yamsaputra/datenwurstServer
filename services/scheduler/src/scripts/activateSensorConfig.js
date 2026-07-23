// Run once by an admin after the LiDAR sensor is physically remounted.
// Inserts a new sensor_configs row and marks it the active one, deactivating
// whatever was active before (mirrors the model_versions.is_active pattern).
// The ingest handler and aggregation job look up the active sensor_config_id
// at write time -- there is no hardcoded default to fall back on, by design,
// so ingest for a remounted sensor simply won't work until this has been run
// (which is correct: if nobody has recorded the new mount position yet,
// attributing new data to it would be a guess).
//
// Usage:
//   docker compose exec scheduler node src/scripts/activateSensorConfig.js \
//     --label "post-remount-2026-08" \
//     --area "learning area main entrance" \
//     [--mount-height 2.4] [--tilt -15] [--notes "corrected mount position"]

import pg from 'pg';
import { nowIso } from '../lib/logger.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = (next === undefined || next.startsWith('--')) ? true : next;
    if (out[key] !== true) i++;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.label) {
  console.error(`[activate-sensor-config][${nowIso()}] Usage: node activateSensorConfig.js --label <label> [--area <text>] [--mount-height <m>] [--tilt <deg>] [--notes <text>]`);
  process.exitCode = 1;
  process.exit();
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query('BEGIN');

  const { rowCount: deactivated } = await client.query(
    'UPDATE sensor_configs SET is_active = FALSE WHERE is_active = TRUE'
  );

  const { rows } = await client.query(`
    INSERT INTO sensor_configs (label, installed_at, position_notes, mount_height_m, tilt_deg, area_covered, is_active)
    VALUES ($1, NOW(), $2, $3, $4, $5, TRUE)
    RETURNING id, label
  `, [
    args.label,
    args.notes ?? null,
    args['mount-height'] ? Number(args['mount-height']) : null,
    args.tilt ? Number(args.tilt) : null,
    args.area ?? null,
  ]);

  await client.query('COMMIT');
  console.log(`[activate-sensor-config][${nowIso()}] Deactivated ${deactivated} previous sensor_config(s).`);
  console.log(`[activate-sensor-config][${nowIso()}] sensor_configs id=${rows[0].id} ("${rows[0].label}") is now active.`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error(`[activate-sensor-config][${nowIso()}] activateSensorConfig.js failed, no changes made:`, err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
