import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitByDayBoundary, InsufficientHoldoutError } from '../src/services/holdoutSplit.js';

const SLOT_MS = 30 * 60 * 1000;

// Berlin-local midnight on 2026-01-01 is 2025-12-31T23:00Z (CET, UTC+1 in
// winter -- no DST transition occurs within a 60-day span starting here, the
// next one is 2026-03-29). Anchoring there, rather than raw UTC midnight,
// keeps each synthetic "day" aligned to an actual Berlin calendar day; using
// UTC midnight instead would split every day's slots 47/1 across two Berlin
// dates and make this fixture wrong, not holdoutSplit.js.
function makeDays(numDays, startDateUTC = Date.UTC(2025, 11, 31, 23, 0)) {
  const rows = [];
  for (let d = 0; d < numDays; d++) {
    for (let s = 0; s < 48; s++) {
      rows.push({ interval_start: new Date(startDateUTC + d * 24 * 60 * 60 * 1000 + s * SLOT_MS).toISOString() });
    }
  }
  return rows;
}

test('holds out the final ~20% of distinct days, on a day boundary', () => {
  const rows = makeDays(60); // 60 days x 48 slots
  const { trainingRows, holdoutRows, holdoutDays } = splitByDayBoundary(rows, { maxLagSteps: 0 });

  assert.equal(holdoutDays.length, 12, '20% of 60 days = 12');
  // Every holdout row's local date must be one of the last 12 dates.
  assert.equal(holdoutRows.length, 12 * 48);
  // No training row shares a date with any holdout row (day-boundary split, never mid-day)
  const trainingDates = new Set(trainingRows.map(r => r.interval_start.slice(0, 10)));
  for (const d of holdoutDays) assert.equal(trainingDates.has(d), false);
});

test('the gap excludes maxLagSteps worth of time before the holdout start from training', () => {
  const rows = makeDays(60);
  const maxLagSteps = 336; // 7 days
  const { trainingRows, holdoutRows } = splitByDayBoundary(rows, { maxLagSteps });

  const holdoutStart = new Date(holdoutRows[0].interval_start).getTime();
  const lastTrainingTime = Math.max(...trainingRows.map(r => new Date(r.interval_start).getTime()));

  assert.ok(holdoutStart - lastTrainingTime >= maxLagSteps * SLOT_MS,
    'no training row should fall within maxLagSteps of the holdout start');
});

test('throws InsufficientHoldoutError when too few distinct days are available', () => {
  const rows = makeDays(5); // only 5 days total, 20% = 1 day holdout, need >=7
  assert.throws(() => splitByDayBoundary(rows, { minHoldoutDays: 7 }), InsufficientHoldoutError);
});

test('a 35-day dataset yields exactly 7 holdout days (right at the minimum) and does not throw', () => {
  const rows = makeDays(35); // 20% of 35 = 7
  const { holdoutDays } = splitByDayBoundary(rows, { minHoldoutDays: 7, maxLagSteps: 0 });
  assert.equal(holdoutDays.length, 7);
});
