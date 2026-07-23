import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDay, localToUtc, utcToLocalParts, UnconfiguredCalendarRangeError } from '../src/lib/calendar.js';

// Mirrors the seed data in db/init/007_calendar_periods.sql exactly, as
// plain objects -- resolveDay() is pure, so no DB is needed to exercise it.
const periods = [
  { label: 'Pre-SS26 break',      period_type: 'break',   start_date: '2026-03-01', end_date: '2026-03-22', opens_local: '10:00:00', closes_local: '17:00:00', specificity: 1 },
  { label: 'SS26 Vorlesungszeit', period_type: 'lecture', start_date: '2026-03-23', end_date: '2026-07-04', opens_local: '09:00:00', closes_local: '19:00:00', specificity: 3 },
  { label: 'SS26 Prüfungszeit',   period_type: 'exam',    start_date: '2026-07-05', end_date: '2026-07-24', opens_local: '09:00:00', closes_local: '19:00:00', specificity: 2 },
  { label: 'SS26 Ferien',         period_type: 'break',   start_date: '2026-07-25', end_date: '2026-09-22', opens_local: '10:00:00', closes_local: '17:00:00', specificity: 1 },
  { label: 'WS26 Vorlesungszeit', period_type: 'lecture', start_date: '2026-09-21', end_date: '2027-01-16', opens_local: '09:00:00', closes_local: '19:00:00', specificity: 3 },
  { label: 'WS26 Prüfungszeit',   period_type: 'exam',    start_date: '2027-01-17', end_date: '2027-02-06', opens_local: '09:00:00', closes_local: '19:00:00', specificity: 2 },
  { label: 'WS26 Ferien',         period_type: 'break',   start_date: '2027-02-07', end_date: '2027-03-22', opens_local: '10:00:00', closes_local: '17:00:00', specificity: 1 },
];

const lectureFree = [
  { label: 'Osterferien',    start_date: '2026-04-02', end_date: '2026-04-07' },
  { label: 'Tag der Arbeit', start_date: '2026-05-01', end_date: '2026-05-01' },
  { label: 'Himmelfahrt',    start_date: '2026-05-14', end_date: '2026-05-15' },
  { label: 'Pfingstmontag',  start_date: '2026-05-25', end_date: '2026-05-25' },
  { label: 'Weihnachten',    start_date: '2026-12-21', end_date: '2026-12-31' },
];

function resolve(date, isHoliday) {
  return resolveDay(date, { periods, lectureFree, isHoliday });
}

test('2026-04-02 Gründonnerstag (not a holiday) -> open 10-17 via rule 3', () => {
  const r = resolve('2026-04-02', false);
  assert.deepEqual(r, { is_open: true, period_type: 'lecture', opens_local: '10:00', closes_local: '17:00', rule: 3 });
});

test('2026-04-03 Karfreitag -> closed via rule 2', () => {
  const r = resolve('2026-04-03', true);
  assert.equal(r.is_open, false);
  assert.equal(r.rule, 2);
});

test('2026-04-06 Ostermontag -> closed via rule 2', () => {
  const r = resolve('2026-04-06', true);
  assert.equal(r.is_open, false);
  assert.equal(r.rule, 2);
});

test('2026-04-07 not a holiday -> open 10-17 via rule 3', () => {
  const r = resolve('2026-04-07', false);
  assert.equal(r.is_open, true);
  assert.equal(r.rule, 3);
  assert.equal(r.opens_local, '10:00');
  assert.equal(r.closes_local, '17:00');
});

test('2026-05-01 Tag der Arbeit -> closed via rule 2', () => {
  const r = resolve('2026-05-01', true);
  assert.equal(r.is_open, false);
  assert.equal(r.rule, 2);
});

test('2026-05-14 Himmelfahrt -> closed via rule 2', () => {
  const r = resolve('2026-05-14', true);
  assert.equal(r.is_open, false);
  assert.equal(r.rule, 2);
});

test('2026-05-15 Brückentag -> open 10-17 via rule 3', () => {
  const r = resolve('2026-05-15', false);
  assert.equal(r.is_open, true);
  assert.equal(r.rule, 3);
});

test('2026-05-25 Pfingstmontag -> closed via rule 2', () => {
  const r = resolve('2026-05-25', true);
  assert.equal(r.is_open, false);
  assert.equal(r.rule, 2);
});

test('2026-09-21 overlap (SS26 Ferien vs WS26 Vorlesungszeit) -> lecture wins, open 09-19 via rule 4', () => {
  const r = resolve('2026-09-21', false);
  assert.deepEqual(r, { is_open: true, period_type: 'lecture', opens_local: '09:00', closes_local: '19:00', rule: 4 });
});

test('2026-10-31 Reformationstag (also a Saturday) -> closed via rule 2, NOT rule 1', () => {
  const r = resolve('2026-10-31', true);
  assert.equal(r.is_open, false);
  assert.equal(r.rule, 2, 'must report rule 2 (holiday) even though the date is also a weekend -- ' +
    'a broken Nager.Date subdivision filter would otherwise hide behind rule 1 and no test would catch it');
});

test('2026-12-24 Heiligabend (not an official holiday) -> open 10-17 via rule 3', () => {
  const r = resolve('2026-12-24', false);
  assert.equal(r.is_open, true);
  assert.equal(r.rule, 3);
});

test('2026-12-31 Silvester (not an official holiday) -> open 10-17 via rule 3', () => {
  const r = resolve('2026-12-31', false);
  assert.equal(r.is_open, true);
  assert.equal(r.rule, 3);
});

test('2027-01-01 Neujahr -> closed via rule 2', () => {
  const r = resolve('2027-01-01', true);
  assert.equal(r.is_open, false);
  assert.equal(r.rule, 2);
});

test('2027-01-02 Saturday, not a holiday -> closed via rule 1', () => {
  const r = resolve('2027-01-02', false);
  assert.equal(r.is_open, false);
  assert.equal(r.rule, 1);
});

test('2026-02-28 outside all configured periods -> throws UnconfiguredCalendarRangeError', () => {
  assert.throws(() => resolve('2026-02-28', false), UnconfiguredCalendarRangeError);
});

test('DST: 2026-07-01 09:00 local (CEST, UTC+2) -> 07:00 UTC', () => {
  const utc = localToUtc('2026-07-01', '09:00');
  assert.equal(utc.toISOString(), '2026-07-01T07:00:00.000Z');
});

test('DST: 2026-12-01 09:00 local (CET, UTC+1) -> 08:00 UTC', () => {
  const utc = localToUtc('2026-12-01', '09:00');
  assert.equal(utc.toISOString(), '2026-12-01T08:00:00.000Z');
});

test('utcToLocalParts round-trips localToUtc', () => {
  const utc = localToUtc('2026-07-01', '09:00');
  const parts = utcToLocalParts(utc);
  assert.deepEqual(parts, { dateLocalYMD: '2026-07-01', timeLocalHHMM: '09:00' });
});
