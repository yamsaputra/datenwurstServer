import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBaselines } from '../src/services/baselines.js';

test('persistence MAE is the mean absolute error of lag1 vs actual', () => {
  const holdout = [
    { occupancy: 10, lag1: 9, lag336: null },
    { occupancy: 8, lag1: 10, lag336: null },
    { occupancy: 12, lag1: 12, lag336: null },
  ];
  const { persistenceMae } = computeBaselines(holdout, []);
  // errors: |10-9|=1, |8-10|=2, |12-12|=0 -> mean = 1
  assert.equal(persistenceMae, 1);
});

test('same-slot-last-week MAE is null when no holdout row has a lag336 value', () => {
  const holdout = [
    { occupancy: 10, lag1: 9, lag336: null },
    { occupancy: 8, lag1: 10, lag336: null },
  ];
  const { sameSlotLastWeekMae } = computeBaselines(holdout, []);
  assert.equal(sameSlotLastWeekMae, null);
});

test('same-slot-last-week MAE only averages over rows that actually have a lag336', () => {
  const holdout = [
    { occupancy: 10, lag1: 9, lag336: 8 },   // error 2
    { occupancy: 8, lag1: 10, lag336: null }, // excluded
    { occupancy: 12, lag1: 12, lag336: 14 },  // error 2
  ];
  const { sameSlotLastWeekMae } = computeBaselines(holdout, []);
  assert.equal(sameSlotLastWeekMae, 2);
});

test('constant median MAE uses the median of the training portion, not the holdout', () => {
  const training = [{ occupancy: 1 }, { occupancy: 2 }, { occupancy: 3 }, { occupancy: 100 }];
  // median of [1,2,3,100] sorted = [1,2,3,100], mid=(2+3)/2=2.5
  const holdout = [{ occupancy: 2.5, lag1: null, lag336: null }, { occupancy: 5.5, lag1: null, lag336: null }];
  const { constantMedianMae } = computeBaselines(holdout, training);
  // errors: |2.5-2.5|=0, |5.5-2.5|=3 -> mean=1.5
  assert.equal(constantMedianMae, 1.5);
});

test('returns null (not NaN or throw) for an empty holdout set', () => {
  const { persistenceMae, sameSlotLastWeekMae, constantMedianMae } = computeBaselines([], [{ occupancy: 5 }]);
  assert.equal(persistenceMae, null);
  assert.equal(sameSlotLastWeekMae, null);
  assert.equal(constantMedianMae, null);
});
