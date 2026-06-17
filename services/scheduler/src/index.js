import cron from 'node-cron';
import fetchWeather       from './jobs/fetchWeather.js';
import generateForecasts  from './jobs/generateForecasts.js';
import aggregateIntervals from './jobs/aggregateIntervals.js';
import cleanup            from './jobs/cleanup.js';
import monthlyRetrain     from './jobs/monthlyRetrain.js';

const TZ = 'Europe/Berlin';

// Hourly at :05 — fetch fresh weather data
cron.schedule('5 * * * *', fetchWeather, { timezone: TZ });

// Hourly at :10 — generate forecasts with latest model
cron.schedule('10 * * * *', generateForecasts, { timezone: TZ });

// Daily at 00:15 — close open intervals and enrich with context
cron.schedule('15 0 * * *', aggregateIntervals, { timezone: TZ });

// Daily at 00:30 — prune old raw events and weather cache
cron.schedule('30 0 * * *', cleanup, { timezone: TZ });

// 1st of each month at 02:00 — retrain ML model
cron.schedule('0 2 1 * *', monthlyRetrain, { timezone: TZ });

console.log('[scheduler] All cron jobs registered (TZ: Europe/Berlin)');

// Run weather fetch on startup so data is immediately available
fetchWeather();
