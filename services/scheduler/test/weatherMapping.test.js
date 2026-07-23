import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findHourlyReading } from '../src/lib/weatherMapping.js';

const hourly = [
  { time: '2026-07-01T13:00', temperature: 20, precip: 0, code: 1 },
  { time: '2026-07-01T14:00', temperature: 22, precip: 0.5, code: 61 },
  { time: '2026-07-01T15:00', temperature: 23, precip: 0, code: 2 },
];

test(':00 slot takes its own hour reading', () => {
  // 2026-07-01 14:00 local (CEST, +2) = 12:00 UTC
  const r = findHourlyReading(hourly, new Date('2026-07-01T12:00:00.000Z'));
  assert.equal(r.temperature, 22);
});

test(':30 slot takes the SAME hour reading (step function, not interpolated)', () => {
  // 2026-07-01 14:30 local = 12:30 UTC -- still within the 14:00 hour
  const r = findHourlyReading(hourly, new Date('2026-07-01T12:30:00.000Z'));
  assert.equal(r.temperature, 22);
  assert.equal(r.code, 61);
});

test('crossing into the next hour picks up the next reading', () => {
  // 2026-07-01 15:00 local = 13:00 UTC
  const r = findHourlyReading(hourly, new Date('2026-07-01T13:00:00.000Z'));
  assert.equal(r.temperature, 23);
});

test('returns null when no reading covers the instant', () => {
  const r = findHourlyReading(hourly, new Date('2026-07-02T12:00:00.000Z'));
  assert.equal(r, null);
});
