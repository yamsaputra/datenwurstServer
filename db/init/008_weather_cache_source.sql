-- Distinguishes forward-looking weather forecasts from backfilled historical
-- readings. Without this, nothing stops a forecast row from satisfying a
-- historical join -- and today weather_cache holds *only* forward forecasts
-- (forecast_for spans 2026-07-11..2026-07-29, entirely after the pilot
-- occupancy data ends 2026-07-09), which is exactly why weather_temp/
-- weather_precip/weather_code are 100% NULL on every occupancy_intervals row.

ALTER TABLE weather_cache
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'forecast'
    CHECK (source IN ('forecast', 'historical'));

UPDATE weather_cache SET source = 'forecast' WHERE source IS DISTINCT FROM 'forecast';

-- The old single-column UNIQUE(forecast_for) can't coexist with wanting both
-- a forecast row and a historical row for the same date, so replace it with
-- a composite constraint. Postgres auto-names an inline column-level UNIQUE
-- as "<table>_<column>_key", which is what 001_schema.sql produced.
ALTER TABLE weather_cache DROP CONSTRAINT IF EXISTS weather_cache_forecast_for_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_cache_forecast_source
  ON weather_cache (forecast_for, source);
