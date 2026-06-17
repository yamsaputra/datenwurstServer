const TWO_PI = 2 * Math.PI;

export function encodeFeatures(interval, stats) {
  const d   = new Date(interval.interval_start);
  const h   = d.getUTCHours();
  const min = d.getUTCMinutes();
  const dow = interval.day_of_week; // 0=Mon…6=Sun
  const woy = getWeekOfYear(d);

  const temp   = normalise(interval.weather_temp,   stats.tempMean,   stats.tempStd);
  const precip = normalise(interval.weather_precip, stats.precipMean, stats.precipStd);
  const code   = (interval.weather_code ?? 0) / 100;

  const lagNorm = (v) => normalise(v ?? 0, stats.occMean, stats.occStd);

  return [
    Math.sin(TWO_PI * h   / 24),
    Math.cos(TWO_PI * h   / 24),
    Math.sin(TWO_PI * min / 60),
    Math.cos(TWO_PI * min / 60),
    Math.sin(TWO_PI * dow / 7),
    Math.cos(TWO_PI * dow / 7),
    Math.sin(TWO_PI * woy / 52),
    Math.cos(TWO_PI * woy / 52),
    interval.is_holiday  ? 1 : 0,
    interval.is_semester ? 0 : 1,
    temp,
    precip,
    code,
    lagNorm(interval.lag1),
    lagNorm(interval.lag2),
    lagNorm(interval.lag48),
    lagNorm(interval.lag336),
    interval.is_open ? 1 : 0,
  ];
}

export function computeStats(rows) {
  const temps   = rows.map(r => r.weather_temp   ?? 15).filter(v => v !== null);
  const precips = rows.map(r => r.weather_precip ?? 0).filter(v => v !== null);
  const occs    = rows.map(r => r.occupancy);

  return {
    tempMean:   mean(temps),   tempStd:   std(temps),
    precipMean: mean(precips), precipStd: std(precips),
    occMean:    mean(occs),    occStd:    std(occs),
  };
}

function normalise(v, m, s) {
  if (v === null || v === undefined || isNaN(v)) return 0;
  return s > 0 ? (v - m) / s : 0;
}

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function std(arr) {
  if (arr.length < 2) return 1;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) || 1;
}

function getWeekOfYear(d) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - start) / 86400000 + start.getUTCDay() + 1) / 7);
}
