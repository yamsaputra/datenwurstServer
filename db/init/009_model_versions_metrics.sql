-- Adds the bookkeeping needed for an honest promotion gate: today
-- trainAndSave() unconditionally activates every model it trains, so six
-- consecutive models that never beat a constant predictor were all deployed
-- with nothing checked. status/holdout_mae/baseline_mae let a future run
-- compare itself against a baseline before touching is_active.
--
-- 'baseline' is also a status value (not just 'trained'/'skipped'/
-- 'rejected'/'active') because of a real FK constraint conflict:
-- forecasts.model_version is NOT NULL REFERENCES model_versions(id), but
-- baseline forecasts (source='baseline' in the next migration) need
-- somewhere to point during the collecting-data period when no LSTM has
-- ever been trained. The sentinel row seeded below is that anchor.

ALTER TABLE model_versions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'trained'
    CHECK (status IN ('trained', 'skipped', 'rejected', 'active', 'baseline')),
  ADD COLUMN IF NOT EXISTS valid_windows     INTEGER,
  ADD COLUMN IF NOT EXISTS holdout_mae       NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS baseline_mae      NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS skip_reason       TEXT,
  ADD COLUMN IF NOT EXISTS feature_count     INTEGER,
  ADD COLUMN IF NOT EXISTS sensor_config_ids INTEGER[];

-- Existing rows: whichever one is currently serving becomes 'active', the
-- rest are 'trained' (the column default), matching what's true today
-- without inventing metric values nobody measured at training time.
UPDATE model_versions SET status = 'active' WHERE is_active = TRUE AND status IS DISTINCT FROM 'active';

-- Sentinel row every source='baseline' forecast points its model_version FK
-- at. train_from/train_to are placeholders (this row represents no actual
-- training run, so there is no real date range to record) -- application
-- code looks this row up by model_path, never by a hardcoded id.
INSERT INTO model_versions (train_from, train_to, model_path, is_active, status)
SELECT '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z', '__baseline__', FALSE, 'baseline'
WHERE NOT EXISTS (SELECT 1 FROM model_versions WHERE model_path = '__baseline__');
