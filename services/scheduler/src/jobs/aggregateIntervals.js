// Finalizes occupancy_intervals: walks every 30-minute slot from the last
// finalized interval up to (but not including) the current in-progress
// slot, writing a row for EVERY slot -- including closed hours and quiet
// hours that never received a real event -- then enriches every row with
// is_open/period_type (calendar), is_holiday (Nager.Date), weather
// (historical only), and marks it is_finalized.
//
// This replaces a job that, before this rewrite, only ever updated rows
// that already existed and did so behind a silent bug: it called
// JSON.parse() on `semester_breaks`, a value `pg` already auto-deserializes
// from JSONB into a real JS array, so JSON.parse([]) threw a SyntaxError
// (JSON.parse stringifies its argument first: String([]) === '', and
// JSON.parse('') throws) before the per-interval update loop ever ran.
// Confirmed by reading the old code directly -- not container health, not
// cron registration, pure silent exception swallowing in the outer
// try/catch. The old job also never created rows for missing slots at all;
// that capability is new here, not a targeted fix.
import db from '../lib/db.js';
import { loadPeriods, loadLectureFree } from '../lib/calendarRepo.js';
import { resolveDay, utcToLocalParts } from '../lib/calendar.js';
import { isHoliday } from '../lib/holidays.js';
import { wasSensorUp } from '../lib/sensorHeartbeat.js';
import { findHourlyReading } from '../lib/weatherMapping.js';
import { nowIso } from '../lib/logger.js';

const SLOT_MS = 30 * 60 * 1000;

export default async function aggregateIntervals({ from, to } = {}) {
  try {
    const range = await resolveRange(from, to);
    if (!range) {
      console.log(`[aggregate][${nowIso()}] Nothing to finalize yet`);
      return;
    }
    const { start, cutoff } = range;
    if (start >= cutoff) {
      console.log(`[aggregate][${nowIso()}] Already up to date, nothing to finalize`);
      return;
    }

    const periods = await loadPeriods();
    const lectureFree = await loadLectureFree();
    const sensorConfigs = await loadSensorConfigs();
    const weatherByDate = new Map(); // dateLocalYMD -> historical hourly readings | null, cached per run

    let finalized = 0;
    for (let slotStart = start; slotStart < cutoff; slotStart = new Date(slotStart.getTime() + SLOT_MS)) {
      await finalizeSlot(slotStart, { periods, lectureFree, sensorConfigs, weatherByDate });
      finalized++;
    }

    await recomputeOccupancy(start, cutoff);

    console.log(`[aggregate][${nowIso()}] Finalized ${finalized} interval(s) from ${start.toISOString()} to ${cutoff.toISOString()}`);
  } catch (err) {
    console.error(`[aggregate][${nowIso()}] Failed:`, err);
  }
}

async function resolveRange(fromOverride, toOverride) {
  const now = new Date();
  const cutoff = toOverride ? new Date(toOverride) : floorToHalfHourUTC(now);

  if (fromOverride) return { start: floorToHalfHourUTC(new Date(fromOverride)), cutoff };

  const { rows: lastRows } = await db.query(
    `SELECT interval_start FROM occupancy_intervals WHERE is_finalized = TRUE ORDER BY interval_start DESC LIMIT 1`
  );
  if (lastRows.length) {
    return { start: new Date(lastRows[0].interval_start.getTime() + SLOT_MS), cutoff };
  }

  const { rows: firstEvent } = await db.query('SELECT min(event_time) AS first FROM raw_events');
  if (!firstEvent[0].first) return null;
  return { start: floorToHalfHourUTC(new Date(firstEvent[0].first)), cutoff };
}

async function loadSensorConfigs() {
  const { rows } = await db.query(
    'SELECT id, installed_at, removed_at FROM sensor_configs ORDER BY installed_at'
  );
  return rows;
}

function sensorConfigIdAt(sensorConfigs, instant) {
  for (const c of sensorConfigs) {
    if (instant >= c.installed_at && (c.removed_at === null || instant < c.removed_at)) return c.id;
  }
  // No configured sensor covers this instant -- fall back to whichever is
  // most recently installed rather than failing the whole finalization
  // pass over a single ambiguous historical slot.
  return sensorConfigs.length ? sensorConfigs[sensorConfigs.length - 1].id : null;
}

function isWithinHours(timeLocalHHMM, opensLocal, closesLocal) {
  if (!opensLocal || !closesLocal) return false;
  return timeLocalHHMM >= opensLocal && timeLocalHHMM < closesLocal;
}

async function getHistoricalWeather(weatherByDate, dateLocalYMD) {
  if (weatherByDate.has(dateLocalYMD)) return weatherByDate.get(dateLocalYMD);
  const { rows } = await db.query(
    `SELECT raw_json FROM weather_cache WHERE forecast_for = $1 AND source = 'historical'`,
    [dateLocalYMD]
  );
  const readings = rows.length ? rows[0].raw_json : null;
  weatherByDate.set(dateLocalYMD, readings);
  return readings;
}

async function finalizeSlot(slotStart, { periods, lectureFree, sensorConfigs, weatherByDate }) {
  const slotEnd = new Date(slotStart.getTime() + SLOT_MS);
  const { dateLocalYMD, timeLocalHHMM } = utcToLocalParts(slotStart);
  const localDow = localIsoDow(dateLocalYMD); // 0=Mon..6=Sun, matches EXTRACT(ISODOW)-1 convention used elsewhere

  const holiday = await isHoliday(dateLocalYMD);
  const resolved = resolveDay(dateLocalYMD, { periods, lectureFree, isHoliday: holiday });
  const isOpenSlot = resolved.is_open && isWithinHours(timeLocalHHMM, resolved.opens_local, resolved.closes_local);
  const sensorConfigId = sensorConfigIdAt(sensorConfigs, slotStart);

  const { rows: existingRows } = await db.query(
    'SELECT entries, exits FROM occupancy_intervals WHERE interval_start = $1',
    [slotStart]
  );
  const existing = existingRows[0];

  const { rows: bucketRows } = await db.query(
    'SELECT COALESCE(SUM(entries), 0)::int AS entries, COALESCE(SUM(exits), 0)::int AS exits, count(*)::int AS n ' +
    'FROM raw_events WHERE event_time >= $1 AND event_time < $2',
    [slotStart, slotEnd]
  );
  const bucket = bucketRows[0];

  let entries, exits, dataStatus;
  if (existing && existing.entries !== null && existing.exits !== null) {
    // Real ingest data already present -- never overwritten, and never
    // gated on is_open: staff arriving before configured opening still get
    // counted, just flagged is_open=false (correctness-overhaul decision #3).
    entries = existing.entries;
    exits = existing.exits;
    dataStatus = 'observed';
  } else if (bucket.n > 0) {
    // No occupancy_intervals row yet, but raw_events exist for this exact
    // slot -- bucket them directly. Normally the ingest-time upsertInterval()
    // already does this reactively as events arrive, but the finalization
    // pass must be able to derive this itself too (a backfill, a bulk
    // import, or any other path that writes raw_events without going
    // through the live ingest handler).
    entries = bucket.entries;
    exits = bucket.exits;
    dataStatus = 'observed';
  } else if (!isOpenSlot) {
    // Closed hours: quiet-vs-down is moot, occupancy is 0 regardless of
    // sensor state.
    entries = 0; exits = 0; dataStatus = 'observed';
  } else if (await wasSensorUp(db, slotStart, sensorConfigId)) {
    // Open, no real event, but the sensor was reporting nearby -- 0/400
    // pilot payloads were ever all-zero, so the Jetson only posts on
    // movement; silence during uptime means no movement, not lost data.
    entries = 0; exits = 0; dataStatus = 'observed';
  } else {
    // Open, no real event, and no evidence the sensor was up nearby either
    // -- occupancy is genuinely unknown, not zero. Heuristic, not a fact:
    // see sensorHeartbeat.js's own doc comment for why this can misclassify
    // an ordinary quiet stretch as an outage in the absence of a real
    // device heartbeat.
    entries = null; exits = null; dataStatus = 'no_data';
  }

  let weatherTemp = null, weatherPrecip = null, weatherCode = null, weatherBackfilled = false;
  const hourly = await getHistoricalWeather(weatherByDate, dateLocalYMD);
  if (hourly) {
    const reading = findHourlyReading(hourly, slotStart);
    if (reading) {
      weatherTemp = reading.temperature;
      weatherPrecip = reading.precip;
      weatherCode = reading.code;
      weatherBackfilled = true;
    }
  }

  await db.query(`
    INSERT INTO occupancy_intervals
      (interval_start, interval_end, day_of_week, entries, exits, is_open, period_type, is_holiday,
       sensor_config_id, data_status, weather_temp, weather_precip, weather_code, weather_backfilled, is_finalized)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE)
    ON CONFLICT (interval_start) DO UPDATE SET
      entries = $4, exits = $5, is_open = $6, period_type = $7, is_holiday = $8,
      data_status = $10, weather_temp = $11, weather_precip = $12, weather_code = $13,
      weather_backfilled = $14, is_finalized = TRUE
  `, [
    slotStart, slotEnd, localDow, entries, exits, isOpenSlot, resolved.period_type, holiday,
    sensorConfigId, dataStatus, weatherTemp, weatherPrecip, weatherCode, weatherBackfilled,
  ]);
}

// 0=Mon..6=Sun, matching EXTRACT(ISODOW FROM ... AT TIME ZONE 'Europe/Berlin')::int - 1
// used elsewhere in the codebase (occupancy.js, dataLoader.js's day_of_week).
function localIsoDow(dateLocalYMD) {
  const isoDow = new Date(`${dateLocalYMD}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return (isoDow + 6) % 7; // 0=Mon..6=Sun
}

/**
 * Recomputes occupancy/clamped for [start, cutoff) via a single
 * chronological running sum, seeded from the last finalized row before
 * `start`. Resets to 0 exactly when a slot transitions from open to closed
 * (a same-day closing time, or a full closed day following an open one) --
 * not at UTC or local midnight, which would leave hours of stale nonzero
 * occupancy sitting in the closed-hours record. 'no_data' slots store
 * occupancy=NULL (unknown, never a fabricated carry-forward number) but the
 * running baseline continues through them unchanged, since there is no
 * better information available about what happened during the gap.
 */
async function recomputeOccupancy(start, cutoff) {
  const { rows: seedRows } = await db.query(`
    SELECT occupancy, is_open FROM occupancy_intervals
    WHERE interval_start < $1 AND is_finalized = TRUE
    ORDER BY interval_start DESC LIMIT 1
  `, [start]);
  let running = (seedRows.length && seedRows[0].is_open && seedRows[0].occupancy !== null) ? seedRows[0].occupancy : 0;
  let prevIsOpen = seedRows.length ? seedRows[0].is_open : false;

  const { rows } = await db.query(`
    SELECT interval_start, entries, exits, is_open, data_status FROM occupancy_intervals
    WHERE interval_start >= $1 AND interval_start < $2
    ORDER BY interval_start
  `, [start, cutoff]);

  for (const row of rows) {
    if (!row.is_open) {
      if (prevIsOpen) running = 0; // just crossed closing time -- force reset
      await db.query('UPDATE occupancy_intervals SET occupancy = 0, clamped = FALSE WHERE interval_start = $1', [row.interval_start]);
    } else if (row.data_status === 'no_data') {
      await db.query('UPDATE occupancy_intervals SET occupancy = NULL, clamped = FALSE WHERE interval_start = $1', [row.interval_start]);
    } else {
      const raw = running + row.entries - row.exits;
      const clamped = raw < 0;
      running = Math.max(0, raw);
      await db.query('UPDATE occupancy_intervals SET occupancy = $2, clamped = $3 WHERE interval_start = $1', [row.interval_start, running, clamped]);
    }
    prevIsOpen = row.is_open;
  }
}

function floorToHalfHourUTC(date) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() < 30 ? 0 : 30);
  return d;
}
