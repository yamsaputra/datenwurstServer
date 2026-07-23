// One-off, idempotent backfill: recomputes is_open/period_type/is_holiday
// for existing occupancy_intervals rows using the real calendar resolver,
// now that calendar_periods/calendar_lecture_free exist (Phase 2). Must run
// AFTER those tables are seeded (migration 007) -- recomputing from ad hoc
// date math instead would risk exactly the kind of drift this whole
// overhaul exists to eliminate. Safe to re-run: only rows whose computed
// value differs from what's stored get touched.
//
// Usage: docker compose exec scheduler node src/scripts/backfillIsOpen.js

import db from '../lib/db.js';
import { loadPeriods, loadLectureFree } from '../lib/calendarRepo.js';
import { resolveDay, utcToLocalParts } from '../lib/calendar.js';
import { isHoliday } from '../lib/holidays.js';
import { nowIso } from '../lib/logger.js';

async function main() {
  const periods = await loadPeriods();
  const lectureFree = await loadLectureFree();

  const { rows } = await db.query('SELECT id, interval_start FROM occupancy_intervals ORDER BY interval_start');
  console.log(`[backfill-is-open][${nowIso()}] Recomputing is_open/period_type/is_holiday for ${rows.length} row(s)...`);

  let updated = 0;
  for (const row of rows) {
    const { dateLocalYMD } = utcToLocalParts(row.interval_start);
    const holiday  = await isHoliday(dateLocalYMD);
    const resolved = resolveDay(dateLocalYMD, { periods, lectureFree, isHoliday: holiday });

    const { rowCount } = await db.query(`
      UPDATE occupancy_intervals
      SET is_open = $1, period_type = $2, is_holiday = $3
      WHERE id = $4
        AND (is_open IS DISTINCT FROM $1 OR period_type IS DISTINCT FROM $2 OR is_holiday IS DISTINCT FROM $3)
    `, [resolved.is_open, resolved.period_type, holiday, row.id]);

    if (rowCount > 0) updated++;
  }

  console.log(`[backfill-is-open][${nowIso()}] Done. ${updated} of ${rows.length} row(s) changed.`);
}

main()
  .catch((err) => {
    console.error(`[backfill-is-open][${nowIso()}] backfillIsOpen.js failed:`, err);
    process.exitCode = 1;
  })
  .finally(() => db.end());
