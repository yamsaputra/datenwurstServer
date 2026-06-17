CREATE INDEX idx_raw_events_event_time  ON raw_events(event_time);
CREATE INDEX idx_raw_events_device_id   ON raw_events(device_id);

CREATE INDEX idx_occ_intervals_start    ON occupancy_intervals(interval_start DESC);
CREATE INDEX idx_occ_intervals_is_open  ON occupancy_intervals(is_open) WHERE is_open = TRUE;

CREATE INDEX idx_forecasts_target       ON forecasts(target_interval);
CREATE INDEX idx_forecasts_generated    ON forecasts(generated_at DESC);
CREATE INDEX idx_forecasts_model        ON forecasts(model_version);

CREATE INDEX idx_model_versions_active  ON model_versions(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_weather_cache_date     ON weather_cache(forecast_for);
