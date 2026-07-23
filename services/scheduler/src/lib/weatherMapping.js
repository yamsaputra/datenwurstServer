import { localToUtc } from './calendar.js';

/**
 * Maps a UTC interval_start to the containing Berlin-local HOUR's weather
 * reading from an Open-Meteo hourly array (fetchWeather.js/
 * fetchWeatherHistorical.js's raw_json shape: [{time, temperature, precip,
 * code}, ...]). `time` is a Berlin-local wall-clock string with no UTC
 * offset (e.g. '2026-07-01T14:00'), since the fetch requests
 * timezone=Europe/Berlin.
 *
 * Deliberately does NOT use `new Date(reading.time)` to interpret that
 * string -- a date-time string with no offset is parsed in whatever
 * timezone the running process happens to be in, which is exactly the
 * UTC-vs-local confusion that left the old aggregateIntervals.js comparing
 * a UTC hour against Berlin-local hourly buckets. localToUtc() does the
 * explicit IANA-zone conversion instead.
 *
 * Step function, not interpolation: both :00 and :30 take the same hour's
 * reading. weather_code is categorical (can't be interpolated) and
 * weather_precip is an hourly accumulation (interpolating would imply a
 * sub-hourly resolution the data doesn't have) -- applying one consistent
 * rule to temperature too is more defensible than mixing methods for a
 * marginal benefit on one field alone. See the README's Weather section.
 *
 * @param {Array<{time: string, temperature: number, precip: number, code: number}>} hourlyReadings
 * @param {Date} utcIntervalStart
 * @returns {{time: string, temperature: number, precip: number, code: number} | null}
 */
export function findHourlyReading(hourlyReadings, utcIntervalStart) {
  for (const reading of hourlyReadings) {
    const [dateLocalYMD, timePart] = reading.time.split('T');
    if (!dateLocalYMD || !timePart) continue;
    const readingUtc = localToUtc(dateLocalYMD, timePart.slice(0, 5));
    const readingUtcEnd = new Date(readingUtc.getTime() + 60 * 60 * 1000);
    if (utcIntervalStart >= readingUtc && utcIntervalStart < readingUtcEnd) {
      return reading;
    }
  }
  return null;
}
