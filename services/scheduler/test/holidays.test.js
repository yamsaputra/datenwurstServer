import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHoliday } from '../src/lib/holidays.js';

// Live network call against date.nager.at, deliberately -- this is the exact
// assertion the correctness-overhaul plan calls for: "If it does not, the
// subdivision filter is wrong." A mocked response could pass this test while
// the real API's field names had drifted out from under the filter.
test('2026-10-31 (Reformationstag, DE-BB only) resolves as a holiday', async () => {
  assert.equal(await isHoliday('2026-10-31'), true);
});

test('2026-01-06 (Epiphany, DE-BW/DE-BY/DE-ST only -- not DE-BB) does not resolve as a holiday', async () => {
  assert.equal(await isHoliday('2026-01-06'), false);
});

test('2026-01-01 (Neujahr, nationwide) resolves as a holiday', async () => {
  assert.equal(await isHoliday('2026-01-01'), true);
});
