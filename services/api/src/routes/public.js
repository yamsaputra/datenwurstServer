import { Router } from 'express';
import { widgetLimiter } from '../middleware/rateLimiter.js';
import { getCurrentOccupancy } from '../services/occupancy.js';
import { getForecastsHours, getForecastsWeek } from '../services/forecast.js';
import { getConfigValue } from '../services/config.js';
import { getActiveForecastState } from '../services/forecastState.js';

const router = Router();

router.get('/widget', widgetLimiter, async (req, res, next) => {
  try {
    const [occupancy, maxOcc, title, capacityLabel, forecastsHours, forecastsWeek, forecastState] = await Promise.all([
      getCurrentOccupancy(),
      getConfigValue('max_occupancy'),
      getConfigValue('widget_title'),
      getConfigValue('capacity_label'),
      getForecastsHours(24),
      getForecastsWeek(),
      getActiveForecastState(),
    ]);
    const max_occupancy = Number(maxOcc) || 150;
    res.json({
      occupancy,
      max_occupancy,
      // Which space max_occupancy actually describes -- the sensor only
      // covers the learning area's main entrance, not the whole building
      // (capacity 150), so the widget must say which one it means.
      capacity_label: capacityLabel || 'Lernbereich',
      percent: Math.min(100, Math.round((occupancy / max_occupancy) * 100)),
      widget_title: title || 'Bibliothek Auslastung',
      active_source: forecastState.active_source,
      data_days_available: forecastState.data_days_available,
      ...(forecastState.forecast_horizon_hours ? { forecast_horizon_hours: forecastState.forecast_horizon_hours } : {}),
      forecasts_hours: forecastState.active_source === 'collecting_data' ? [] : forecastsHours,
      forecasts_week:  forecastState.active_source === 'collecting_data' ? [] : forecastsWeek,
    });
  } catch (err) { next(err); }
});

export default router;
