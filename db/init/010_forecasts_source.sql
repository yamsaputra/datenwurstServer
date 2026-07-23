-- Marks which generator produced a forecast row. model_version stays
-- NOT NULL (no relaxation needed) -- baseline-sourced rows point at the
-- sentinel model_versions row seeded in 009_model_versions_metrics.sql,
-- looked up by model_path='__baseline__', never a hardcoded id.
--
-- Deliberately NOT adding a uniqueness constraint on target_interval alone:
-- history across runs is worth keeping (1,342 duplicate target_interval
-- values exist today across 34 runs). Every read path must instead select
-- the newest/active row per target -- see services/api/src/services/forecastState.js.

ALTER TABLE forecasts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'lstm'
    CHECK (source IN ('lstm', 'baseline'));
