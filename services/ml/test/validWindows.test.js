import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidWindow, findValidWindows } from '../src/services/validWindows.js';

function makeRow(offsetSlots, overrides = {}) {
  return {
    interval_start: new Date(Date.UTC(2026, 6, 1, 0, 0) + offsetSlots * 30 * 60 * 1000),
    is_finalized: true,
    data_status: 'observed',
    weather_temp: 15, weather_precip: 0, weather_code: 1,
    sensor_config_id: 1,
    occupancy: 5,
    ...overrides,
  };
}

test('a fully contiguous, well-formed run of rows is one valid window', () => {
  const rows = Array.from({ length: 24 }, (_, i) => makeRow(i));
  assert.equal(isValidWindow(rows), true);
  assert.equal(findValidWindows(rows, 24).length, 1);
});

test('mirrors the confirmed pilot-data bug: a single day-boundary gap yields ZERO valid 24-windows, not 79', () => {
  // 102 rows total, but with a real gap inserted partway through (mimicking
  // the pilot data's Friday-evening-to-Monday-morning and 2025-11-15 splices)
  // -- a purely positional slice would still report 102-24+1=79 "windows".
  const before = Array.from({ length: 60 }, (_, i) => makeRow(i));
  const after = Array.from({ length: 42 }, (_, i) => makeRow(i + 60 + 100)); // real gap: +100 slots (50h) later
  const rows = [...before, ...after];
  assert.equal(rows.length, 102);

  const windows = findValidWindows(rows, 24);
  // Only contiguous stretches >=24 long can ever produce a valid window.
  // before.length=60 -> 60-24+1=37 valid windows; after.length=42 -> 42-24+1=19.
  assert.equal(windows.length, 37 + 19);
  // Critically, none of them straddle the gap.
  for (const w of windows) {
    assert.equal(isValidWindow(w), true);
  }
});

test('a single unfinalized row invalidates any window containing it', () => {
  const rows = Array.from({ length: 24 }, (_, i) => makeRow(i));
  rows[10].is_finalized = false;
  assert.equal(isValidWindow(rows), false);
  assert.equal(findValidWindows(rows, 24).length, 0);
});

test('a single no_data row invalidates any window containing it', () => {
  const rows = Array.from({ length: 24 }, (_, i) => makeRow(i));
  rows[5].data_status = 'no_data';
  assert.equal(isValidWindow(rows), false);
});

test('NULL weather invalidates the window (recency-gap protection)', () => {
  const rows = Array.from({ length: 24 }, (_, i) => makeRow(i));
  rows[20].weather_temp = null;
  assert.equal(isValidWindow(rows), false);
});

test('a sensor_config_id change within the window invalidates it, even with no time gap', () => {
  const rows = Array.from({ length: 24 }, (_, i) => makeRow(i));
  rows[15].sensor_config_id = 2;
  assert.equal(isValidWindow(rows), false, 'training must never mix sensor generations within one window');
});

test('findValidWindows returns nothing when rows.length < windowLength', () => {
  const rows = Array.from({ length: 10 }, (_, i) => makeRow(i));
  assert.equal(findValidWindows(rows, 24).length, 0);
});
