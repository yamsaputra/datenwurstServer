// Read-only check of whether enough contiguous data exists to attempt
// training -- reuses the exact same window-counting machinery trainModel.js
// uses at train time (loadRows -> splitByDayBoundary -> buildWindows), so
// "ready" here can never disagree with what a real training attempt would
// find. Builds no model, writes no model_versions row.
import { loadRows, buildWindows, computeStats } from './dataLoader.js';
import { splitByDayBoundary, InsufficientHoldoutError } from './holdoutSplit.js';
import { getConfigValue } from './config.js';

export async function checkReadiness() {
  const minTrainingWindows = Number((await getConfigValue('ml.min_training_windows')) ?? 2000);
  const rows = await loadRows();

  let trainingRows;
  try {
    ({ trainingRows } = splitByDayBoundary(rows));
  } catch (err) {
    if (err instanceof InsufficientHoldoutError) {
      return { validWindows: 0, minTrainingWindows, ready: false };
    }
    throw err;
  }

  const stats = computeStats(trainingRows);
  const { validWindowCount } = buildWindows(trainingRows, stats);

  return {
    validWindows: validWindowCount,
    minTrainingWindows,
    ready: validWindowCount >= minTrainingWindows,
  };
}
