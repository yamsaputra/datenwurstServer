-- Splits the overloaded is_open column (it used to mean both "library is
-- open" AND "the aggregation job has closed/enriched this row") and adds
-- data_status so an interval with genuinely unknown occupancy (sensor down)
-- can be told apart from one that is known to be zero (library closed).
--
-- is_open's default flips TRUE -> FALSE deliberately: a bug in the
-- computation should now produce obviously-wrong data (everything closed)
-- rather than the previous plausibly-wrong default (everything open, which
-- is exactly how this got stuck unnoticed for the entire pilot run).

ALTER TABLE occupancy_intervals
  ALTER COLUMN is_open SET DEFAULT FALSE;

-- 'no_data' rows must be able to carry an unknown (NULL) occupancy rather
-- than a fabricated zero -- see Phase 3.2 of the correctness-overhaul plan.
ALTER TABLE occupancy_intervals
  ALTER COLUMN entries   DROP NOT NULL,
  ALTER COLUMN exits     DROP NOT NULL,
  ALTER COLUMN occupancy DROP NOT NULL;

ALTER TABLE occupancy_intervals
  ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_status  TEXT NOT NULL DEFAULT 'observed'
    CHECK (data_status IN ('observed', 'no_data')),
  ADD COLUMN IF NOT EXISTS period_type  TEXT
    CHECK (period_type IN ('lecture', 'exam', 'break')),
  ADD COLUMN IF NOT EXISTS clamped      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weather_backfilled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_occ_intervals_unfinalized
  ON occupancy_intervals (is_finalized) WHERE is_finalized = FALSE;

-- Existing pilot rows are historical: the aggregation job will never need to
-- revisit them. is_open/period_type are intentionally left at their new
-- defaults (FALSE/NULL) here -- they get recomputed for real once the
-- calendar tables/resolver exist (services/scheduler/src/scripts/backfillIsOpen.js),
-- never guessed at with ad hoc date math inside a migration.
UPDATE occupancy_intervals
SET is_finalized = TRUE
WHERE is_finalized IS DISTINCT FROM TRUE;

-- The confirmed 2026-07-04 sensor-outage placeholder rows are inserted in
-- 006_sensor_configs.sql instead of here: they need sensor_config_id, which
-- doesn't exist as a column until that migration, and by the second time
-- these files run (e.g. a fresh-volume bootstrap that also gets re-applied
-- via db/migrate.sh) sensor_config_id is NOT NULL with no default -- Postgres
-- validates NOT NULL before an ON CONFLICT DO NOTHING arbiter ever gets a
-- chance to skip the row, so an INSERT here that omits it would fail on
-- every run after the first.
