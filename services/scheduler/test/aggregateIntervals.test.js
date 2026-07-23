import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../src/lib/db.js';
import { localToUtc } from '../src/lib/calendar.js';
import aggregateIntervals from '../src/jobs/aggregateIntervals.js';

// NOTE on the chosen date: the correctness-overhaul plan's own Phase 3.3
// example fixture uses 2026-08-11 and describes it as "a Tuesday in SS26
// Vorlesungszeit (open 09:00-19:00 local)". Under the calendar actually
// seeded in 007_calendar_periods.sql, SS26 Vorlesungszeit ends 2026-07-04 and
// 2026-08-11 falls in SS26 Ferien (break, 10:00-17:00) instead -- an
// inconsistency between the plan's own two sections, not something this
// suite invented. 2026-06-16 is used instead: also a Tuesday, genuinely
// inside SS26 Vorlesungszeit, not a holiday, not in any lecture-free range --
// so the fixture's original intent (lecture hours, 09:00-19:00 local /
// 07:00-17:00 UTC in summer) is preserved exactly, just on a date where it's
// actually true.
const TEST_DAY = '2026-06-16';       // Tuesday, lecture period
const OUTAGE_DAY = '2026-06-17';     // Wednesday, same period, zero events
const HOLIDAY_DAY = '2026-10-31';    // Reformationstag AND a Saturday

async function clearFixture(dateLocalYMD) {
  const start = localToUtc(dateLocalYMD, '00:00');
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  await db.query('DELETE FROM raw_events WHERE event_time >= $1 AND event_time < $2', [start, end]);
  await db.query('DELETE FROM occupancy_intervals WHERE interval_start >= $1 AND interval_start < $2', [start, end]);
}

before(async () => {
  await clearFixture(TEST_DAY);
  await clearFixture(OUTAGE_DAY);
  await clearFixture(HOLIDAY_DAY);
});

after(async () => {
  await clearFixture(TEST_DAY);
  await clearFixture(OUTAGE_DAY);
  await clearFixture(HOLIDAY_DAY);
  await db.end();
});

test('main fixture: 48 rows, correct carry-forward, correct heartbeat-driven no_data tail', async () => {
  // event_time in UTC; 2026-06-16 is CEST (+2h): 07:04Z/07:33Z/09:02Z local to 09:04/09:35/11:02
  await db.query(`
    INSERT INTO raw_events (received_at, device_id, event_time, entries, exits, payload_hash, sensor_config_id)
    VALUES
      (NOW(), 'test-jetson', '2026-06-16T07:04:00Z', 3, 0, 'fixture-t1', 1),
      (NOW(), 'test-jetson', '2026-06-16T07:33:00Z', 5, 1, 'fixture-t2', 1),
      (NOW(), 'test-jetson', '2026-06-16T09:02:00Z', 0, 4, 'fixture-t3', 1)
  `);

  const start = localToUtc(TEST_DAY, '00:00');
  const cutoff = localToUtc('2026-06-17', '00:00');
  await aggregateIntervals({ from: start, to: cutoff });

  const { rows } = await db.query(`
    SELECT interval_start, entries, exits, occupancy, is_open, is_finalized, data_status, period_type, is_holiday, clamped
    FROM occupancy_intervals WHERE interval_start >= $1 AND interval_start < $2 ORDER BY interval_start
  `, [start, cutoff]);

  assert.equal(rows.length, 48, 'every 30-min slot in the local day must have a row');
  assert.ok(rows.every(r => r.is_finalized === true));
  assert.ok(rows.every(r => r.is_holiday === false));
  assert.ok(rows.every(r => r.period_type === 'lecture'));

  const byUtcHour = new Map(rows.map(r => [r.interval_start.toISOString().slice(11, 16), r]));

  // Closed hours before opening (00:00-06:30 UTC = 02:00-08:30 local)
  for (const t of ['00:00', '03:00', '06:30']) {
    assert.equal(byUtcHour.get(t).is_open, false, `${t} should be closed`);
    assert.equal(byUtcHour.get(t).data_status, 'observed');
    assert.equal(Number(byUtcHour.get(t).occupancy), 0);
  }

  // 09:00 local (07:00 UTC): real event, entries 3, occupancy 3
  assert.equal(byUtcHour.get('07:00').is_open, true);
  assert.equal(byUtcHour.get('07:00').entries, 3);
  assert.equal(byUtcHour.get('07:00').exits, 0);
  assert.equal(Number(byUtcHour.get('07:00').occupancy), 3);

  // 09:30 local (07:30 UTC): real event, entries 5 exits 1, occupancy 7
  assert.equal(byUtcHour.get('07:30').entries, 5);
  assert.equal(byUtcHour.get('07:30').exits, 1);
  assert.equal(Number(byUtcHour.get('07:30').occupancy), 7);

  // 10:00/10:30 local (08:00/08:30 UTC): quiet but sensor-up (heartbeat true), carried forward at 7, not 0
  for (const t of ['08:00', '08:30']) {
    assert.equal(byUtcHour.get(t).data_status, 'observed');
    assert.equal(byUtcHour.get(t).entries, 0);
    assert.equal(byUtcHour.get(t).exits, 0);
    assert.equal(Number(byUtcHour.get(t).occupancy), 7, `${t} should carry forward at 7, not reset to 0`);
  }

  // 11:00 local (09:00 UTC): real event, exits 4, occupancy 3
  assert.equal(byUtcHour.get('09:00').exits, 4);
  assert.equal(Number(byUtcHour.get('09:00').occupancy), 3);

  // 09:30-11:00 UTC (11:30-13:00 local): still within 2 hours of the 09:02 UTC
  // event (07:33 UTC's window reaches to 09:30; 09:02 UTC's own window
  // reaches to 11:02) -- heartbeat-true, carried forward at 3 (the post-exit
  // value from the 09:00 UTC slot), not reset to 0.
  for (const t of ['09:30', '10:00', '10:30', '11:00']) {
    assert.equal(byUtcHour.get(t).data_status, 'observed', `${t} should still be observed (within heartbeat range)`);
    assert.equal(byUtcHour.get(t).entries, 0);
    assert.equal(byUtcHour.get(t).exits, 0);
    assert.equal(Number(byUtcHour.get(t).occupancy), 3, `${t} should carry forward at 3, not reset to 0`);
  }

  // 11:30 UTC (13:30 local) onward through 16:30 UTC (18:30 local): more than
  // 2 hours past the last real event (09:02 UTC's window ends at 11:02 UTC)
  // -- the heartbeat heuristic correctly (if imperfectly, by its own
  // documented design) cannot tell this quiet stretch apart from an outage,
  // and marks it no_data. This is the heuristic behaving exactly as
  // specified in the correctness-overhaul plan, not a bug -- see
  // sensorHeartbeat.js's doc comment.
  const noDataTail = ['11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  for (const t of noDataTail) {
    const r = byUtcHour.get(t);
    assert.equal(r.data_status, 'no_data', `${t} should be no_data`);
    assert.equal(r.entries, null);
    assert.equal(r.exits, null);
    assert.equal(r.occupancy, null, `${t} occupancy must be NULL, not a fabricated carry-forward value`);
  }

  // Closing time: 19:00 local (17:00 UTC) onward is closed, occupancy reset to 0
  for (const t of ['17:00', '17:30', '23:30']) {
    assert.equal(byUtcHour.get(t).is_open, false, `${t} should be closed`);
    assert.equal(Number(byUtcHour.get(t).occupancy), 0, `${t} occupancy must reset to 0 at closing, not carry a stale value`);
  }

  assert.ok(rows.every(r => r.clamped === false), 'no negative cumulative sum ever occurred in this fixture');
});

test('idempotency: re-running the same range produces the same 48 rows, no duplicates', async () => {
  const start = localToUtc(TEST_DAY, '00:00');
  const cutoff = localToUtc('2026-06-17', '00:00');
  await aggregateIntervals({ from: start, to: cutoff });

  const { rows } = await db.query(
    'SELECT count(*) AS n FROM occupancy_intervals WHERE interval_start >= $1 AND interval_start < $2',
    [start, cutoff]
  );
  assert.equal(Number(rows[0].n), 48);
});

test('holiday fixture: 2026-10-31 (Reformationstag, also a Saturday) is closed all day despite inserted events', async () => {
  const start = localToUtc(HOLIDAY_DAY, '00:00');
  const cutoff = localToUtc('2026-11-01', '00:00');

  await db.query(`
    INSERT INTO raw_events (received_at, device_id, event_time, entries, exits, payload_hash, sensor_config_id)
    VALUES (NOW(), 'test-jetson', '2026-10-31T10:00:00Z', 2, 0, 'fixture-holiday', 1)
  `);

  await aggregateIntervals({ from: start, to: cutoff });

  const { rows } = await db.query(`
    SELECT is_open, is_holiday FROM occupancy_intervals WHERE interval_start >= $1 AND interval_start < $2
  `, [start, cutoff]);

  assert.equal(rows.length, 48);
  assert.ok(rows.every(r => r.is_open === false), 'every slot must be closed on a public holiday');
  assert.ok(rows.every(r => r.is_holiday === true), 'every slot must be flagged is_holiday');
});

test('outage fixture: a day with zero raw_events comes back no_data (NULL occupancy) during open hours, not zeros', async () => {
  const start = localToUtc(OUTAGE_DAY, '00:00');
  const cutoff = localToUtc('2026-06-18', '00:00');

  await aggregateIntervals({ from: start, to: cutoff });

  const { rows } = await db.query(`
    SELECT interval_start, is_open, data_status, occupancy, entries, exits
    FROM occupancy_intervals WHERE interval_start >= $1 AND interval_start < $2 ORDER BY interval_start
  `, [start, cutoff]);

  assert.equal(rows.length, 48);
  const openRows = rows.filter(r => r.is_open);
  const closedRows = rows.filter(r => !r.is_open);

  assert.equal(openRows.length, 20, '09:00-19:00 local is a 10-hour window = 20 half-hour slots');
  assert.ok(openRows.every(r => r.data_status === 'no_data'));
  assert.ok(openRows.every(r => r.occupancy === null));
  assert.ok(openRows.every(r => r.entries === null && r.exits === null));

  assert.ok(closedRows.every(r => r.data_status === 'observed'));
  assert.ok(closedRows.every(r => Number(r.occupancy) === 0));
});
