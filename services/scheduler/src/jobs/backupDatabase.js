// Daily CSV export of every data table, as a safety net alongside (not a
// replacement for) the manual `pg_dump` instructions in the README -- a
// full pg_dump is the right tool for a full restore, but a plain per-table
// CSV is easier to spot-check, diff, or partially recover from without
// needing a Postgres instance at hand.
//
// `users` is deliberately excluded: dumping password hashes into plaintext
// CSV files on disk is a needless security exposure this backup doesn't
// need to take on, and account recovery already has createUser.js.
//
// Runs via plain SQL + manual CSV serialization rather than pulling in
// pg-copy-streams, to avoid a new dependency for what these table sizes
// don't need streaming for.
import fs from 'fs';
import path from 'path';
import db from '../lib/db.js';
import { nowIso } from '../lib/logger.js';

const BACKUP_ROOT = process.env.BACKUP_PATH || '/app/backups';
const RETENTION_DAYS = 30;

const TABLES = [
  'raw_events',
  'occupancy_intervals',
  'forecasts',
  'model_versions',
  'weather_cache',
  'config',
  'sensor_configs',
  'calendar_periods',
  'calendar_lecture_free',
];

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let str;
  if (value instanceof Date) str = value.toISOString();
  else if (typeof value === 'object') str = JSON.stringify(value);
  else str = String(value);
  if (/[",\n\r]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
  return str;
}

async function backupTable(table, destDir) {
  const { rows, fields } = await db.query(`SELECT * FROM ${table} ORDER BY 1`);
  const columns = fields.map(f => f.name);
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map(col => csvEscape(row[col])).join(','));
  }
  fs.writeFileSync(path.join(destDir, `${table}.csv`), lines.join('\n') + '\n');
  return rows.length;
}

function pruneOldBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return 0;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let pruned = 0;
  for (const entry of fs.readdirSync(BACKUP_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(BACKUP_ROOT, entry.name);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs < cutoff) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      pruned++;
    }
  }
  return pruned;
}

export default async function backupDatabase() {
  try {
    const stamp = new Date().toISOString().replace(/:/g, '-');
    const destDir = path.join(BACKUP_ROOT, stamp);
    fs.mkdirSync(destDir, { recursive: true });

    const counts = {};
    for (const table of TABLES) {
      counts[table] = await backupTable(table, destDir);
    }

    const pruned = pruneOldBackups();
    console.log(`[backup][${nowIso()}] Wrote ${TABLES.length} table(s) to ${destDir} (${JSON.stringify(counts)}); pruned ${pruned} backup(s) older than ${RETENTION_DAYS} days`);
  } catch (err) {
    console.error(`[backup][${nowIso()}] Failed:`, err.message);
  }
}
