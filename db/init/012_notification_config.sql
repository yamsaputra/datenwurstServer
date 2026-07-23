-- Config keys for two dashboard/ops features added after the initial
-- correctness overhaul: an advisory (non-blocking) warning when training
-- is attempted on less than a recommended data span, and a training-
-- readiness notification (dashboard banner + optional webhook) fired once
-- when enough contiguous data exists to attempt training.
--
-- ml.min_training_days_recommended is deliberately separate from
-- ml.min_training_windows: the latter is the real, technical, hard gate
-- (contiguous 24-step windows, enforced in trainModel.js -- training
-- refuses below it, no exception). The former is a friendlier, earlier,
-- advisory figure surfaced in the dashboard UI only; it never blocks
-- anything.

INSERT INTO config (key, value) VALUES
  ('ml.min_training_days_recommended', '182'),
  ('notifications.webhook_url',        'null'),
  ('ml.readiness_notified',            'false')
ON CONFLICT (key) DO NOTHING;
