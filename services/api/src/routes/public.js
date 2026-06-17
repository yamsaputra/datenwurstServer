import { Router } from 'express';
import { widgetLimiter } from '../middleware/rateLimiter.js';
import { getCurrentOccupancy } from '../services/occupancy.js';
import { getForecastsHours, getForecastsWeek } from '../services/forecast.js';
import { getConfigValue } from '../services/config.js';

const router = Router();

router.get('/widget', widgetLimiter, async (req, res, next) => {
  try {
    const [occupancy, maxOcc, title, forecastsHours, forecastsWeek] = await Promise.all([
      getCurrentOccupancy(),
      getConfigValue('max_occupancy'),
      getConfigValue('widget_title'),
      getForecastsHours(12),
      getForecastsWeek(),
    ]);
    const max_occupancy = Number(maxOcc) || 150;
    res.json({
      occupancy,
      max_occupancy,
      percent: Math.min(100, Math.round((occupancy / max_occupancy) * 100)),
      widget_title: title || 'Bibliothek Auslastung',
      forecasts_hours: forecastsHours,
      forecasts_week:  forecastsWeek,
    });
  } catch (err) { next(err); }
});

export default router;
