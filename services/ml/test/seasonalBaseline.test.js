import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeasonalProfileFromRows } from '../src/services/seasonalBaseline.js';

test('averages occupancy per (weekday, local hour/minute) slot', () => {
  // 2026-06-16 is a Tuesday. 12:00 local (CEST, +2h) = 10:00 UTC.
  const rows = [
    { day_of_week: 1, interval_start: '2026-06-16T10:00:00Z', occupancy: 10 },
    { day_of_week: 1, interval_start: '2026-06-23T10:00:00Z', occupancy: 20 }, // also a Tuesday, same slot
    { day_of_week: 1, interval_start: '2026-06-16T11:00:00Z', occupancy: 100 }, // different slot (13:00 local)
  ];
  const profile = buildSeasonalProfileFromRows(rows);
  assert.equal(profile.forSlot(1, 12, 0), 15); // (10+20)/2
});

test('falls back to the weekday average when the exact slot has no data', () => {
  const rows = [
    { day_of_week: 2, interval_start: '2026-06-17T08:00:00Z', occupancy: 4 }, // 10:00 local
    { day_of_week: 2, interval_start: '2026-06-17T09:00:00Z', occupancy: 6 }, // 11:00 local
  ];
  const profile = buildSeasonalProfileFromRows(rows);
  // no data at all for 15:00 local on weekday 2 -- falls back to weekday average (4+6)/2=5
  assert.equal(profile.forSlot(2, 15, 0), 5);
});

test('falls back to the overall average when neither the slot nor the weekday has data', () => {
  const rows = [
    { day_of_week: 0, interval_start: '2026-06-15T08:00:00Z', occupancy: 2 },
    { day_of_week: 3, interval_start: '2026-06-18T08:00:00Z', occupancy: 8 },
  ];
  const profile = buildSeasonalProfileFromRows(rows);
  assert.equal(profile.forSlot(5, 3, 0), 5); // (2+8)/2, no weekday-5 or exact-slot data at all
});

test('rows with null occupancy are excluded from the average', () => {
  const rows = [
    { day_of_week: 1, interval_start: '2026-06-16T10:00:00Z', occupancy: 10 },
    { day_of_week: 1, interval_start: '2026-06-23T10:00:00Z', occupancy: null },
  ];
  const profile = buildSeasonalProfileFromRows(rows);
  assert.equal(profile.forSlot(1, 12, 0), 10);
});
