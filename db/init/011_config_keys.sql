-- Corrects the seeded library coordinates (48.1372/11.5755 is Munich, ~500km
-- from TH Brandenburg) and adds the config keys the correctness-overhaul
-- introduces. Safe as an unconditional UPDATE: no admin UI has ever written
-- a different value to library_lat/library_lon (opening_hours and
-- semester_breaks are the only config keys with any write path, and they
-- are being superseded by calendar_periods/calendar_lecture_free, not these).

UPDATE config SET value = '52.41' WHERE key = 'library_lat';
UPDATE config SET value = '12.55' WHERE key = 'library_lon';

INSERT INTO config (key, value) VALUES
  ('ml.min_training_windows', '2000'),
  ('ml.min_baseline_days',    '14'),
  ('capacity_label',          '"Lernbereich"')
ON CONFLICT (key) DO NOTHING;
