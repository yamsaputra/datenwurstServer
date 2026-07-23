-- Sensor provenance: which physical sensor/mount produced a given row.
-- Needed because the LiDAR is being remounted in a corrected position, and
-- occupancy_intervals/raw_events must never let a training window silently
-- mix data from two different physical configurations.

CREATE TABLE IF NOT EXISTS sensor_configs (
  id             SERIAL PRIMARY KEY,
  label          TEXT NOT NULL,
  installed_at   TIMESTAMPTZ NOT NULL,
  removed_at     TIMESTAMPTZ,
  position_notes TEXT,
  mount_height_m NUMERIC,
  tilt_deg       NUMERIC,
  area_covered   TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row 1 is the pilot pre-remount configuration: historical, already removed,
-- never "active" in the is_active sense (that flag drives which config new
-- ingest gets attributed to -- see services/scheduler/src/scripts/activateSensorConfig.js,
-- run once by an admin after the physical remount is complete).
INSERT INTO sensor_configs (id, label, installed_at, removed_at, area_covered, position_notes, is_active)
VALUES (
  1,
  'pilot-2026-07-pre-remount',
  '2026-07-02T00:00:00Z',
  '2026-07-09T07:30:00Z',
  'learning area main entrance',
  'Pilot mount position. Sensor was deactivated 2026-07-09 for remounting in a corrected position; see sensor_configs row created by activateSensorConfig.js for the post-remount configuration.',
  FALSE
)
ON CONFLICT (id) DO NOTHING;

SELECT setval('sensor_configs_id_seq', GREATEST((SELECT MAX(id) FROM sensor_configs), 1));

-- The 2025-11-15 10:00 UTC occupancy_intervals row has no matching raw_events
-- row at all and predates the pilot by seven and a half months -- an orphan
-- that only inflates span/date-range calculations. Targeted by its exact
-- timestamp, not a date-range delete, so this can never catch real data.
DELETE FROM occupancy_intervals WHERE interval_start = '2025-11-15T10:00:00Z';

ALTER TABLE occupancy_intervals
  ADD COLUMN IF NOT EXISTS sensor_config_id INTEGER NOT NULL DEFAULT 1 REFERENCES sensor_configs(id);
ALTER TABLE occupancy_intervals
  ALTER COLUMN sensor_config_id DROP DEFAULT;

ALTER TABLE raw_events
  ADD COLUMN IF NOT EXISTS sensor_config_id INTEGER NOT NULL DEFAULT 1 REFERENCES sensor_configs(id);
ALTER TABLE raw_events
  ALTER COLUMN sensor_config_id DROP DEFAULT;

-- Confirmed sensor outage: Saturday 2026-07-04, 10:00-16:00 Europe/Berlin
-- (a gap under the *old*, pre-overhaul opening_hours config, which had the
-- library open Saturdays 10:00-16:00 -- the new calendar seeded in
-- 007_calendar_periods.sql closes all Saturdays unconditionally going
-- forward, but that has no bearing on what this historical pilot-era window
-- actually was). These 30-minute slots have no matching row at all today;
-- insert them as explicit "occupancy unknown" placeholders, tagged to the
-- pilot sensor_config_id=1, rather than leaving them as silent gaps. This
-- runs here (not in 005_occupancy_interval_status_columns.sql) because
-- sensor_config_id must be provided explicitly by the second time this file
-- runs (its default is dropped above), and this is the first point in
-- migration order where the column is guaranteed to already exist.
INSERT INTO occupancy_intervals (interval_start, interval_end, day_of_week, entries, exits, occupancy, is_finalized, data_status, sensor_config_id)
SELECT
  slot,
  slot + INTERVAL '30 minutes',
  EXTRACT(ISODOW FROM slot AT TIME ZONE 'Europe/Berlin')::int - 1,
  NULL, NULL, NULL,
  TRUE,
  'no_data',
  1
FROM generate_series(
  '2026-07-04 10:00'::timestamp AT TIME ZONE 'Europe/Berlin',
  '2026-07-04 15:30'::timestamp AT TIME ZONE 'Europe/Berlin',
  INTERVAL '30 minutes'
) AS slot
ON CONFLICT (interval_start) DO NOTHING;

-- Also catches any row that already existed in this window before this
-- migration ran (so a re-run, or a database where a stray real row already
-- occupies one of these slots, still ends up correctly nulled-out).
UPDATE occupancy_intervals
SET data_status = 'no_data', entries = NULL, exits = NULL, occupancy = NULL
WHERE (interval_start AT TIME ZONE 'Europe/Berlin')::date = '2026-07-04'
  AND (interval_start AT TIME ZONE 'Europe/Berlin')::time >= '10:00'
  AND (interval_start AT TIME ZONE 'Europe/Berlin')::time <  '16:00'
  AND (data_status IS DISTINCT FROM 'no_data' OR occupancy IS NOT NULL OR entries IS NOT NULL OR exits IS NOT NULL);
