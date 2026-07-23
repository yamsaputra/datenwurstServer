// The single valid-window predicate/finder, used by training (dataLoader.js)
// and anywhere else that needs to know how much genuinely-usable contiguous
// history exists. Replaces the confirmed-buggy positional slice in the old
// loadTrainingData (`rows.slice(i, i+LOOKBACK)` over the SQL result ordered
// only by interval_start, with zero check of actual timestamp deltas --
// `102 - 24 + 1 = 79` matched the known "79 windows from 102 rows" symptom
// exactly, since every possible positional slide was being counted
// regardless of real contiguity).
//
// A window of length `windowLength` (lookback + horizon) is valid only if
// every row in it is finalized, observed, has complete weather, shares one
// sensor_config_id with the rest of the window, and is exactly 30 minutes
// after the previous row -- never mixing across a gap, a sensor swap, or an
// unfinalized/no_data/weather-pending row.

const SLOT_MS = 30 * 60 * 1000;

export function isValidWindow(rows) {
  if (!rows.length) return false;
  const sensorConfigId = rows[0].sensor_config_id;
  let prevTime = null;

  for (const r of rows) {
    if (!r.is_finalized) return false;
    if (r.data_status !== 'observed') return false;
    if (r.weather_temp === null || r.weather_precip === null || r.weather_code === null) return false;
    if (r.sensor_config_id !== sensorConfigId) return false;

    const thisTime = new Date(r.interval_start).getTime();
    if (prevTime !== null && thisTime - prevTime !== SLOT_MS) return false;
    prevTime = thisTime;
  }
  return true;
}

/**
 * @param {Array<object>} rows rows ordered by interval_start ascending
 * @param {number} windowLength e.g. LOOKBACK + HORIZON
 * @returns {Array<Array<object>>} every valid contiguous window found
 */
export function findValidWindows(rows, windowLength) {
  const windows = [];
  for (let i = 0; i + windowLength <= rows.length; i++) {
    const candidate = rows.slice(i, i + windowLength);
    if (isValidWindow(candidate)) windows.push(candidate);
  }
  return windows;
}
