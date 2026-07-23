import cron from 'node-cron';
import fetchWeather           from './jobs/fetchWeather.js';
import fetchWeatherHistorical from './jobs/fetchWeatherHistorical.js';
import generateForecasts      from './jobs/generateForecasts.js';
import aggregateIntervals     from './jobs/aggregateIntervals.js';
import cleanup                from './jobs/cleanup.js';
import monthlyRetrain         from './jobs/monthlyRetrain.js';
import checkTrainingReadiness from './jobs/checkTrainingReadiness.js';
import backupDatabase         from './jobs/backupDatabase.js';
import { nowIso } from './lib/logger.js';

const TZ = 'Europe/Berlin';

// Hourly at :05 — fetch fresh weather forecast data
cron.schedule('5 * * * *', fetchWeather, { timezone: TZ });

// Hourly at :10 — generate forecasts with latest model
cron.schedule('10 * * * *', generateForecasts, { timezone: TZ });

// Daily at 00:10 — export every data table (except users) to CSV under
// db/backups/<timestamp>/, pruning backups older than 30 days. Runs before
// aggregateIntervals/cleanup so it captures pre-finalization state; this is
// a safety net, not a point-in-time snapshot guarantee.
cron.schedule('10 0 * * *', backupDatabase, { timezone: TZ });

// Daily at 00:15 — close finished intervals, deriving is_open/period_type
// from the calendar, is_holiday from Nager.Date, weather from historical
// data only, and writing every 30-min slot (including closed/quiet hours)
cron.schedule('15 0 * * *', aggregateIntervals, { timezone: TZ });

// Daily at 00:20 — fetch settled historical weather (needs aggregateIntervals'
// finalized rows to exist first) and retry backfilling any interval still
// waiting on the archive to catch up
cron.schedule('20 0 * * *', fetchWeatherHistorical, { timezone: TZ });

// Daily at 00:30 — prune old raw events and forecast-only weather cache rows
// (historical rows are never pruned, however old — see cleanup.js)
cron.schedule('30 0 * * *', cleanup, { timezone: TZ });

// Daily at 00:25 — notify (dashboard banner + optional webhook) once enough
// contiguous data exists to attempt training; see checkTrainingReadiness.js
// for why this fires at most once per readiness episode
cron.schedule('25 0 * * *', checkTrainingReadiness, { timezone: TZ });

// 1st of each month at 02:00 — retrain ML model
cron.schedule('0 2 1 * *', monthlyRetrain, { timezone: TZ });

console.log(`[scheduler][${nowIso()}] All cron jobs registered (TZ: Europe/Berlin)`);

// Run weather fetch and forecast generation on startup so data is
// immediately available instead of waiting for the next hourly tick.
fetchWeather().then(generateForecasts);
