// Reference-only baselines computed on the same hold-out set as the LSTM,
// so a trained model can be judged against something other than itself.
// Evidence from the pilot hold-out (Jul 3/6/7 train, Jul 8 test): persistence
// MAE 2.61, seasonal mean 2.94, same-day-yesterday 3.08, constant mean 7.83,
// vs the actively-served LSTM v6 at 7.21 -- statistically indistinguishable
// from a constant. This is what the promotion gate (trainModel.js) checks
// against; the seasonal-mean baseline itself lives in seasonalBaseline.js,
// since it also serves as a real forecast source, not just an evaluation
// reference.

function mae(rows, predictFn) {
  const errors = rows
    .filter(r => r.occupancy !== null && r.occupancy !== undefined)
    .map(r => {
      const predicted = predictFn(r);
      return predicted === null || predicted === undefined ? null : Math.abs(r.occupancy - predicted);
    })
    .filter(e => e !== null);
  return errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null;
}

function median(values) {
  const clean = values.filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

/**
 * @param {Array<{occupancy: number, lag1: number|null, lag336: number|null}>} holdoutRows
 * @param {Array<{occupancy: number|null}>} trainingRows
 * @returns {{persistenceMae: number|null, sameSlotLastWeekMae: number|null, constantMedianMae: number|null}}
 */
export function computeBaselines(holdoutRows, trainingRows) {
  const persistenceMae = mae(holdoutRows, r => r.lag1);

  // lag-336 (same slot, 7 days ago) is only computable when a row genuinely
  // has a predecessor 336 steps back -- returns null, never a fabricated
  // number or a thrown error, when no holdout row has one available.
  const withLag336 = holdoutRows.filter(r => r.lag336 !== null && r.lag336 !== undefined);
  const sameSlotLastWeekMae = withLag336.length ? mae(withLag336, r => r.lag336) : null;

  const trainingMedian = median(trainingRows.map(r => r.occupancy));
  const constantMedianMae = trainingMedian === null ? null : mae(holdoutRows, () => trainingMedian);

  return { persistenceMae, sameSlotLastWeekMae, constantMedianMae };
}
