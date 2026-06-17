CREATE TABLE raw_events (
  id           BIGSERIAL PRIMARY KEY,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id    TEXT NOT NULL,
  event_time   TIMESTAMPTZ NOT NULL,
  entries      INTEGER NOT NULL CHECK (entries >= 0),
  exits        INTEGER NOT NULL CHECK (exits >= 0),
  payload_hash TEXT NOT NULL,
  UNIQUE(device_id, payload_hash)
);

CREATE TABLE occupancy_intervals (
  id              BIGSERIAL PRIMARY KEY,
  interval_start  TIMESTAMPTZ NOT NULL UNIQUE,
  interval_end    TIMESTAMPTZ NOT NULL,
  entries         INTEGER NOT NULL DEFAULT 0,
  exits           INTEGER NOT NULL DEFAULT 0,
  occupancy       INTEGER NOT NULL DEFAULT 0,
  is_open         BOOLEAN NOT NULL DEFAULT TRUE,
  weather_temp    NUMERIC(5,2),
  weather_precip  NUMERIC(5,2),
  weather_code    SMALLINT,
  is_holiday      BOOLEAN NOT NULL DEFAULT FALSE,
  is_semester     BOOLEAN NOT NULL DEFAULT TRUE,
  day_of_week     SMALLINT NOT NULL
);

CREATE TABLE model_versions (
  id           SERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active    BOOLEAN NOT NULL DEFAULT FALSE,
  train_from   TIMESTAMPTZ NOT NULL,
  train_to     TIMESTAMPTZ NOT NULL,
  epochs       INTEGER,
  loss_final   NUMERIC(10,6),
  mae_final    NUMERIC(10,6),
  model_path   TEXT NOT NULL,
  notes        TEXT
);

CREATE TABLE forecasts (
  id              BIGSERIAL PRIMARY KEY,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_interval TIMESTAMPTZ NOT NULL,
  predicted_occ   NUMERIC(8,2) NOT NULL,
  model_version   INTEGER NOT NULL REFERENCES model_versions(id),
  UNIQUE(target_interval, model_version)
);

CREATE TABLE config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

CREATE TABLE weather_cache (
  id           SERIAL PRIMARY KEY,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  forecast_for DATE NOT NULL UNIQUE,
  raw_json     JSONB NOT NULL
);
