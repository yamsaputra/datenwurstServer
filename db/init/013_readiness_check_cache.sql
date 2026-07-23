-- Caches the daily checkTrainingReadiness.js job's result so the dashboard
-- can display it by reading a config value instead of triggering a live
-- recomputation (a full table scan + window-count pass) on every poll.

INSERT INTO config (key, value) VALUES
  ('ml.last_readiness_check', 'null')
ON CONFLICT (key) DO NOTHING;
