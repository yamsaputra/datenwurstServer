# Library Occupancy Forecasting Platform

Real-time occupancy tracking and ML-based forecasting for library spaces.
Receives people-counting data from an NVIDIA Jetson Orin Nano, stores it,
predicts future occupancy in 30-minute intervals, and exposes a protected
admin dashboard and a public embeddable widget.

---

## Tech Stack & Libraries

| Service       | Language/Runtime | Key Libraries |
|---------------|-------------------|----------------|
| `frontend`    | Next.js 14 / React 18 (TypeScript) | `next`, `react`, `react-dom`, `recharts`, `lucide-react`, `clsx`, `tailwind-merge`, `tailwindcss` |
| `api`         | Node.js (ESM) | `express`, `express-rate-limit`, `jsonwebtoken`, `bcrypt`, `cookie-parser`, `cors`, `pg`, `node-fetch` |
| `ml`          | Node.js (ESM) | `@tensorflow/tfjs-node`, `express`, `pg` |
| `scheduler`   | Node.js (ESM) | `node-cron`, `node-fetch`, `pg` |
| `db`          | PostgreSQL 16 | — |
| `nginx`       | nginx | TLS termination, reverse proxy |

---

## Version History

| Version | Date       | Changes |
|---------|------------|---------|
| v2.1.0  | 2026-07-23 | Follow-up to v2.0.0 after deploying it to the dev database surfaced four operational gaps. **Automated CSV backups**: a new daily job (`backupDatabase.js`, 00:10) exports every table except `users` (excluded deliberately — dumping password hashes into plaintext CSV files is a needless exposure) to `db/backups/<ISO-timestamp>/<table>.csv`, pruning backups older than 30 days. A spot-checkable safety net alongside, not a replacement for, the `pg_dump` instructions in [Backup](#backup). **Training-readiness notification**: a new daily job (`checkTrainingReadiness.js`, 00:25) runs the same window-counting logic used at train time (`validWindows.js`, not a day-count proxy) and, the first time `ml.min_training_windows` is satisfied, shows a persistent dashboard banner and optionally POSTs to `notifications.webhook_url` (`{event:'training_ready', valid_windows, min_training_windows, timestamp}`). `trainModel.js` resets the notified flag on every subsequent training attempt (skipped/rejected/active alike) so a later data change can notify again. **Insufficient-data warning**: `/dashboard/ml` now shows a non-blocking warning when `data_days_available` is under `ml.min_training_days_recommended` (default 182, ~6 months) — training can still be started; the backend's `ml.min_training_windows` gate is the real enforcement, this is only an earlier, friendlier heads-up. **ISO 8601 timestamps on every log line**: every `console.log`/`warn`/`error` call site across all three services now includes a timestamp (`[tag][2026-07-23T14:32:10.123Z] message`) via a one-line `nowIso()` helper per service (`src/lib/logger.js`) — needed because `docker compose logs` interleaves output from five containers with no per-line time reference of its own. See [Scheduled Jobs](#scheduled-jobs), [Config Keys](#config-keys), [Logging](#logging), and [Backup](#backup). |
| v2.0.0  | 2026-07-23 | Correctness overhaul of ingestion, aggregation, and evaluation, done during the maintenance window while the LiDAR sensor was offline for remounting. **Root cause of the v1.3.0 known issue confirmed and fixed:** `aggregateIntervals.js` called `JSON.parse()` on `semester_breaks`, a value `pg` already auto-deserializes from JSONB into a real array — `JSON.parse([])` stringifies its argument first (`String([]) === ''`) and then throws, before the per-interval update loop ever ran; caught by an outer `catch` that only logged, so every invocation silently closed zero intervals, forever. A second, independent cause is also fixed: `weather_cache` held only forward-looking forecasts with zero date overlap against occupancy data, so the backfill would have failed even with the cron bug fixed. **Missing intervals are now written for every 30-minute slot**, including closed and quiet hours, not just slots with a real sensor event — the change that makes contiguous training windows possible at all. **`is_open` split into `is_open`/`is_finalized`/`data_status`**, ending a naming collision that meant "the library is open" and "the aggregation job closed this row" were the same boolean; `is_open` now defaults to `FALSE` instead of `TRUE`. **Calendar-driven opening hours** replace the config-based `opening_hours`/`semester_breaks`, which had no mechanism to ever change `is_open` away from its stuck default. **`is_semester` replaced by a three-way `period_type`** (lecture/exam/break), moving the feature count 18→20 and invalidating every previously-trained model by input shape — `loadModel.js` now checks `feature_count` before loading and falls back to the seasonal baseline instead of crashing. **Weather split into forecast/historical sources**, backfilling real historical weather from Open-Meteo's Historical Forecast API (chosen over Archive/ERA5 for train/serve distribution consistency) instead of leaving every occupancy row's weather columns permanently `NULL`. **Time-based hold-out replaces `validationSplit: 0.1`** (which gave 8 validation windows spanning about 4 hours of one afternoon), splitting on day boundaries with a 336-step gap to prevent lag-feature leakage. **Early stopping replaces a fixed 50 epochs** (which was 150 total gradient steps on the pilot data — under-trained toward the mean, not overfitted) — TF.js's built-in early stopping has no `restoreBestWeights`, so this required a custom callback. **A minimum-window guard refuses to train** below `ml.min_training_windows` (default 2000) rather than training on whatever happens to be available. **A promotion gate compares every trained model's hold-out MAE against a seasonal-mean baseline** computed on the same hold-out, replacing unconditional promotion — six consecutive models had previously been promoted despite none beating a constant predictor. **Three-state serving cascade** (`lstm`/`baseline`/`collecting_data`) with a 2-hour staleness guard (the autoregressive loop used to anchor on the last database row instead of "now", and kept serving a dead forecast for 13 days once ingestion stalled) and a 12-hour horizon cap (multi-day autoregressive output was confirmed byte-identical across days 2–7 in every complete run on record). **Sensor-configuration provenance** (`sensor_configs`) ensures training never mixes data across a physical remount. See [Database Schema](#database-schema), [Migrations](#migrations), [Semester Calendar](#semester-calendar), [Weather](#weather), [Forecasting](#forecasting), and [Known Limitations](#known-limitations) for details. |
| v1.4.0  | 2026-07-06 | Fixed a client-side crash on `/dashboard/ml`: `ModelStatusCard.tsx` threw `toFixed is not a function` because `pg` (node-postgres) returns `NUMERIC`/`DECIMAL` columns as strings by default, not numbers — so `model_versions.mae_final`/`loss_final` (`NUMERIC(10,6)`) arrived as e.g. `"3.119192"`, and the optional-chained `.toFixed()` call still ran since a non-empty string is truthy. The same issue silently affected other `NUMERIC` columns (`predicted_occ`, `weather_temp`, `weather_precip`) in the API service too, just without crashing yet — `ForecastChart.tsx`'s `Math.round()` happens to coerce strings to numbers implicitly, unlike a direct `.toFixed()` call. Fixed at the source instead of per-component: registered a `pg` type parser for `NUMERIC` (OID 1700 → `parseFloat`) in `services/api/src/db.js`, `services/ml/src/db.js`, and `services/scheduler/src/lib/db.js`, so every service now returns real JS numbers for these columns. |
| v1.3.0  | 2026-07-06 | Fixed "Train Model" always returning a generic 500: `services/api/src/middleware/errorHandler.js` and `services/ml/src/middleware/errorHandler.js` were discarding `err.message` for every 5xx response, so the dashboard never saw the real failure. The actual cause was `/app/models` being owned by `root` in the `ml` container while the process runs as the non-root `node` user (`services/ml/Dockerfile`), so `model.save()` failed with `EACCES`; fixed by chowning the directory to `node` at build time. Also gave the "Not enough data to train" guard in `trainModel.js` a proper `400` status, and replaced a non-functional `node-fetch` v3 `timeout` option with `AbortSignal.timeout()` in `mlClient.js`. **Known issue found while investigating, not yet fixed:** `services/scheduler/src/jobs/aggregateIntervals.js` (daily cron at 00:15 Europe/Berlin) is supposed to close finished `occupancy_intervals` rows and backfill `weather_temp`/`weather_precip`/`weather_code`/`is_holiday`/`is_semester`, but on the VM every interval stays `is_open = TRUE` with null weather columns days after the fact, even though `weather_cache` itself is populated correctly — real contextual signal never reaches the ML pipeline. Needs its own investigation (scheduler container health/logs). **Resolved in v2.0.0**: root cause was a `JSON.parse()` call on an already-deserialized JSONB value throwing on every invocation, silently caught by an outer `try`/`catch`. The "`weather_cache` itself is populated correctly" claim above was also incomplete — it held only forward forecasts with zero date overlap against occupancy data, a second independent bug fixed by v2.0.0's forecast/historical source split. |
| v1.2.0  | 2026-07-05 | Fixed `.devcontainer/devcontainer.json`, which was an empty stub causing VS Code's "Reopen in Container" to fail with a "config not found" error — now attaches to the `frontend` service via the existing `docker-compose.yml`/`docker-compose.override.yml` stack. Removed the empty, unused `.devcontainer/Dockerfile` and `.devcontainer/app/app.py` placeholder files. Enabled reliable frontend hot-reload in the dev container by adding `WATCHPACK_POLLING: "true"` to the `frontend` service in `docker-compose.override.yml`. Removed the redundant hardcoded `NEXT_PUBLIC_API_URL` override from dev compose — value now comes solely from `.env`. Fixed an ML training bug where the Huber loss was passed as the string `'huberLoss'` instead of the `tf.losses.huberLoss` function reference in `buildModel.js`. Added the "Tech Stack & Libraries" table to this README. |
| v1.1.0  | 2026-06-25 | Removed Next.js API proxy rewrites — browser now calls the API directly via `NEXT_PUBLIC_API_URL`. Centralized API base URL via exported `API_BASE` in `api.ts`. Updated `login` and `dashboard/layout` to use `API_BASE`. Converted `postcss.config.js` from ESM to CommonJS. Added `env.d.ts` for TypeScript environment variable declarations. |
| v1.0.0  | 2026-06-25 | Initial release: Docker Compose stack with Next.js frontend, Node.js API, TF.js ML service, PostgreSQL, nginx, and scheduler. |

---

## System Architecture

```
Internet
  │
nginx (443 TLS)
  ├── /               → frontend   (Next.js dashboard)
  ├── /widget         → frontend   (public iframe, framing allowed)
  ├── /api/v1/public/ → api        (open CORS, rate-limited)
  ├── /api/v1/ingest/ → api        (Jetson webhook, API-key auth)
  └── /api/           → api        (JWT auth)

scheduler (no external port)
  ├── hourly   → Open-Meteo (weather)
  ├── hourly   → ml service (forecast generation)
  ├── daily    → PostgreSQL (interval aggregation, cleanup)
  └── monthly  → ml service (model retraining)

api ──────────────────────────────────────────────────────┐
ml  (internal Docker network only, X-ML-Secret auth)      │
scheduler ─────────────────────────────────────────────── ┤
                                                           ▼
                                                     PostgreSQL 16
```

**Services and ports:**

| Service   | Port (internal) | Exposed externally |
|-----------|-----------------|--------------------|
| nginx     | 80, 443         | Yes — entry point  |
| frontend  | 3000            | Via nginx only     |
| api       | 3001            | Via nginx only     |
| ml        | 3002            | No — internal only |
| scheduler | —               | No                 |
| db        | 5432            | No (dev: yes)      |

> **Note (v1.1.0):** The frontend no longer uses Next.js API proxy rewrites.
> The browser calls the API directly via `NEXT_PUBLIC_API_URL`, so that variable
> must be set to a publicly reachable URL in both dev and production.

---

## Database Schema

### `raw_events`

One row per Jetson payload. `payload_hash` (sha256 of device_id + event_time +
entries + exits) plus `UNIQUE(device_id, payload_hash)` gives idempotent
ingestion — a resent payload is silently dropped. `sensor_config_id` (added
v2.0.0) attributes every event to a physical sensor generation; the ingest
handler looks this up from whichever `sensor_configs` row is currently
`is_active`, and refuses (rather than guessing) if none is.

### `occupancy_intervals`

One row per 30-minute slot. As of v2.0.0 this includes **every** slot in a
finalized range — closed hours and quiet hours included, not just slots with
a real event.

Three columns that are easy to conflate, so precise definitions:

| Column | Meaning |
|---|---|
| `is_open` | **Calendar-derived only.** Was the library open per the semester calendar, holidays, and time of day. Computed once by the aggregation job, never touched afterward. |
| `is_finalized` | Has the nightly aggregation job closed and enriched this row (holiday/period/weather). `FALSE` only for the current in-progress slot. |
| `data_status` | `'observed'` — a real value (from a sensor event, or correctly zero because the sensor was up but quiet, or correctly zero because the library was closed) — or `'no_data'` — the sensor's state is unknown, so `entries`/`exits`/`occupancy` are `NULL`, never a fabricated zero. |

Before v2.0.0, `is_open` conflated the calendar meaning with the "has this
row been closed out" meaning, defaulted to `TRUE`, and was never actually
recomputed — every one of the 102 pilot rows had `is_open = TRUE`, including
rows at Saturday 23:30 local. Splitting these apart, and defaulting `is_open`
to `FALSE`, means a bug now produces obviously-wrong data instead of
plausibly-wrong data.

`is_semester` (the original boolean) is retained as a **derived, read-only**
column for backward compatibility with older dashboard queries — reads
compute it live from `period_type <> 'break'` rather than storing it
separately, so there is only one source of truth. `period_type`
(`'lecture'|'exam'|'break'`) is the real field going forward; see
[Semester Calendar](#semester-calendar).

`clamped` records when the running occupancy sum went negative and was
floored to 0 — a real counting-drift signal (12 of the 102 pilot rows hit
this, worst case -11) that was previously silently discarded. If this starts
firing frequently after remount, it's an early sign the sensor is degrading.

`weather_backfilled` tracks whether `weather_temp`/`weather_precip`/
`weather_code` have been filled from the *historical* archive — see
[Weather](#weather). `sensor_config_id` is a partitioning key, not a model
feature; training must never mix sensor generations within one window.

### `sensor_configs`

One row per physical sensor mount. `is_active` (mirroring
`model_versions.is_active`) drives which config new ingest is attributed to.
See [Sensor Configurations](#sensor-configurations).

### `calendar_periods` / `calendar_lecture_free`

The semester calendar as data. See [Semester Calendar](#semester-calendar).

### `weather_cache`

`source` (`'forecast'|'historical'`) distinguishes forward-looking Open-Meteo
forecasts from the backfilled historical archive — a forecast row must never
satisfy a historical join. Unique on `(forecast_for, source)`, so both can
coexist for the same date.

### `model_versions`

`status` (`'trained'|'skipped'|'rejected'|'active'|'baseline'`) records the
outcome of every retrain attempt, not just successful ones. `valid_windows`,
`holdout_mae`, `baseline_mae`, and `skip_reason` make the promotion decision
auditable. One sentinel row (`model_path = '__baseline__'`, `status =
'baseline'`) exists so seasonal-baseline forecasts have a `model_version` FK
to point at. See [Forecasting](#forecasting).

### `forecasts`

`source` (`'lstm'|'baseline'`) marks which generator produced a row. No
uniqueness constraint on `target_interval` alone — history across runs is
kept deliberately — so every read path selects the newest/best row per
target rather than relying on a database constraint to prevent duplicates.

### `config`

Key-value store (JSONB values). New in v2.0.0: `ml.min_training_windows`,
`ml.min_baseline_days`, `capacity_label`. See [Config Keys](#config-keys).
`opening_hours` and `semester_breaks` are superseded by `calendar_periods`/
`calendar_lecture_free` and are no longer read by any code path — the rows
are left in place (harmless) rather than deleted.

---

## Migrations

Schema changes live in `db/init/`, numbered `NNN_description.sql`, and are
written idempotently (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT
EXISTS`, `CREATE INDEX IF NOT EXISTS`, guarded `UPDATE`/`INSERT ... ON
CONFLICT`).

> **This is the single most important operational fact in this document:**
> `db/init/*.sql` is executed by the official Postgres image's
> `docker-entrypoint-initdb.d` mechanism, which **only ever runs once, on a
> brand-new, empty data volume.** On any deployment that already has data —
> which is every real deployment after its first boot — these scripts never
> run again. Editing `db/init/` and redeploying does **nothing** on an
> existing server unless you also apply the migration manually.

A `schema_migrations(filename, applied_at)` table tracks what has been
applied. To bring an existing, already-running deployment up to date:

```bash
docker compose exec -T db sh < db/migrate.sh
```

This is safe to run repeatedly — already-applied files are skipped — and
safe to run on a database that has never seen it before (it creates
`schema_migrations` itself if needed). `001`–`003` are bootstrap-only and are
never re-applied by this script; they are implicitly already in effect on any
database that has data.

To add a new migration: create the next-numbered `db/init/NNN_*.sql` file,
write every statement idempotently, and run `db/migrate.sh` against your
deployment. New files also run automatically via the normal bootstrap path on
a fresh install, so they must work correctly both ways.

---

## Semester Calendar

Opening hours are calendar-driven, not config-driven. `calendar_periods` rows
define date ranges with a `period_type` (`lecture`/`exam`/`break`), opening
hours, and a `specificity` (lecture=3, exam=2, break=1) that resolves
overlapping periods — the highest specificity wins. `calendar_lecture_free`
rows mark individual lecture-free days inside a lecture period (e.g.
Gründonnerstag) — these take break hours, not a closure.

**Resolution cascade, first match wins:**

1. Saturday or Sunday → closed
2. Public holiday in the configured subdivision (`HOLIDAY_SUBDIVISION`,
   default `DE-BB`) → closed
3. Lecture-free day inside a lecture period → break hours (10:00–17:00)
4. Period type → lecture/exam 09:00–19:00, break 10:00–17:00

A date with no matching `calendar_periods` row throws a named
`UnconfiguredCalendarRangeError` rather than silently defaulting — this is
precisely how the old `is_semester` flag ended up permanently `TRUE` (the
config-based `semester_breaks` list was empty and nothing ever noticed).

**Adding a future semester** is a data change, not a code change: insert new
`calendar_periods`/`calendar_lecture_free` rows via a migration. No
application code references specific dates or semester labels.

All comparisons between UTC-stored `interval_start` values and Europe/Berlin
local opening hours go through explicit IANA timezone conversion
(`services/scheduler/src/lib/calendar.js`), never `Date#getHours()` (which
reads in the *process's* local timezone, a container configuration detail)
and never manual UTC-offset arithmetic (which breaks across the March/October
DST transitions).

Holiday lookups use the Nager.Date v3 API and check both `global`/`counties`
and the documented future replacement fields `nationalHoliday`/
`subdivisionCodes`, since a country-level-only check misses every
state-specific holiday (e.g. Reformationstag, a public holiday in Brandenburg
but not nationwide).

---

## Weather

Two independent sources, both from Open-Meteo, distinguished by
`weather_cache.source`:

- **Forward forecast** (`source='forecast'`, hourly job): the live Forecast
  API, needed as a model input across the inference horizon. Unchanged in
  purpose from before v2.0.0.
- **Historical** (`source='historical'`, daily job): backfills weather for
  past occupancy data from Open-Meteo's **Historical Forecast API**
  (`historical-forecast-api.open-meteo.com`), *not* the Archive/ERA5 API.

**Why Historical Forecast API, not Archive/ERA5:** at inference time the
model is fed forward forecasts from the live Forecast API. ERA5 reanalysis is
corrected against observations that arrive after the fact; live forecasts are
not. Training on ERA5 would teach the model relationships against a variable
it never actually receives in production — a train/serve distribution
mismatch. The Historical Forecast API is Open-Meteo's own recommended source
for exactly this consistency requirement, and has a shorter typical lag than
ERA5 as a side benefit. **Trade-off:** this optimizes for train/serve
consistency, not fidelity to actual historical weather — if you need accurate
retrospective weather for some other analysis, pull ERA5 separately for that.

**Hour-to-half-hour mapping is a step function**, not interpolation: both
`:00` and `:30` take their containing hour's reading. `weather_code` is
categorical and can't be interpolated; `weather_precip` is an hourly
accumulation, so interpolating would imply a sub-hourly resolution the data
doesn't have. Applying one consistent rule to temperature too, rather than
mixing methods, is the more defensible default — linear interpolation of
temperature alone is a reasonable future refinement, not implemented here.

**Recency gap:** the historical archive doesn't have data for the last day
or two immediately after it happens. Affected intervals are left with `NULL`
weather and `weather_backfilled=FALSE` — never a substituted forecast value,
never an imputed guess — and retried automatically the next day. The
training window-validity check treats `NULL` weather as invalidating, so a
lagging backfill delays training rather than corrupting it.

**Manual backfill**, e.g. after a coordinate correction or an extended outage:

```bash
docker compose exec scheduler node src/scripts/backfillWeather.js \
  --from 2026-08-01 --to 2026-08-31 [--dry-run]
```

Idempotent and rate-limit aware; logs how many intervals were updated versus
skipped for the archive not yet being settled.

---

## Forecasting

Three serving states, in order of preference:

1. **`lstm`** — an LSTM model is active, its `feature_count` matches the
   live encoder, and its stored `holdout_mae` beat the seasonal baseline at
   training time. Capped at a **12-hour horizon** (see below).
2. **`baseline`** — no eligible LSTM, but at least `ml.min_baseline_days`
   (default 14) of valid history exists. A seasonal mean (average occupancy
   by weekday and half-hour slot) — a real forecast source, not just an
   evaluation reference.
3. **`collecting_data`** — neither. No numbers are shown; the widget renders
   this explicitly as "collecting data — forecast not yet available".

The public API (`GET /api/v1/public/widget`) and the internal dashboard
(`GET /api/v1/dashboard/forecasts/meta`) both expose `active_source` and
`data_days_available` so the frontend always knows which state it's in and
never has to guess from the shape of the data.

**Staleness guard:** a forecast is only published if its seed data is less
than 2 hours old. Before this, the autoregressive loop anchored on "the last
row in the database" rather than "now" — once ingestion stalled, it kept
re-predicting the same dead period indefinitely with nothing noticing (one
observed run kept serving a week-old forecast for 13 days).

**12-hour horizon cap:** the LSTM's autoregressive loop feeds its own
predictions back as lag features; every complete multi-day run on record
converged to a fixed point within the first day (days 2–7 byte-identical
across every model version checked). Publishing is capped at 24 half-hour
steps; a 7-day view is served entirely from the seasonal baseline instead,
labeled "typical for this time" — never presented as a model prediction.
*(Planned, not yet implemented: replacing the autoregressive loop with a
direct multi-horizon output head, which would eliminate this compounding
failure mode rather than cap around it.)*

**Promotion gate:** a monthly retrain only activates a new model if its
`holdout_mae` (computed on a genuinely held-out, day-boundary time split)
beats the seasonal baseline's MAE on the same holdout. Every attempt writes a
`model_versions` row — `active` (promoted), `rejected` (trained but didn't
beat the baseline, previous model/baseline keeps serving), or `skipped` (not
enough valid contiguous training windows, no model file written). Read
`skip_reason`/`holdout_mae`/`baseline_mae` on any non-active row to see why.

---

## Config Keys

| Key | Default | Meaning |
|---|---|---|
| `ml.min_training_windows` | `2000` | Minimum valid contiguous 24-step windows required before a retrain is attempted. Roughly 6 weeks of continuous data. A floor, not a target. |
| `ml.min_baseline_days` | `14` | Minimum distinct days of valid history before the seasonal baseline will serve a forecast, so each (weekday, slot) cell has at least two observations. |
| `capacity_label` | `"Lernbereich"` | What space `max_occupancy` describes. The sensor covers only the learning area's main entrance, not the whole building (capacity ~150) — this makes the widget say so explicitly rather than implying building-wide occupancy. |
| `library_lat` / `library_lon` | `52.41` / `12.55` | TH Brandenburg's approximate coordinates. Read only from this table, never from an environment variable. |
| `ml.min_training_days_recommended` | `182` | Dashboard-only heads-up threshold (~6 months) behind the "not enough data yet" warning on `/dashboard/ml`. Training itself is gated by `ml.min_training_windows`, not this value — this is purely an earlier, friendlier warning, not a second enforcement layer. |
| `notifications.webhook_url` | `null` | If set, POSTed to once when `checkTrainingReadiness.js` first detects enough valid data to train — see [Scheduled Jobs](#scheduled-jobs). `null` disables the webhook; the dashboard banner shows either way. |

Two further keys, `ml.readiness_notified` and `ml.last_readiness_check`, back
the training-readiness feature above as an internal cache/state pair (whether
a notification has already fired for the current readiness episode, and the
last computed `{validWindows, minTrainingWindows, ready}` result so the
dashboard can read a cheap cached value instead of recomputing on every poll).
Not meant to be hand-edited.

---

## Sensor Configurations

`sensor_configs` records each physical sensor mount (position, height, tilt,
area covered) with an `is_active` flag mirroring `model_versions.is_active`.
Ingest and aggregation attribute new data to whichever config is currently
active; there is no hardcoded fallback, by design — attributing data to a
guessed configuration would be worse than refusing.

After a physical remount, activate the new configuration once:

```bash
docker compose exec scheduler node src/scripts/activateSensorConfig.js \
  --label "post-remount-2026-08" \
  --area "learning area main entrance" \
  [--mount-height 2.4] [--tilt -15] [--notes "corrected mount position"]
```

**Training must never mix `sensor_config_id` values within a single
window** — enforced in the window-validity check itself
(`services/ml/src/services/validWindows.js`), not merely by convention, so a
remount can never silently blend two different physical calibrations into
one model.

---

## Known Limitations

- **No live sensor data exists yet to validate any model against.** The
  pilot week (2026-07-02 to 2026-07-09) is pre-remount, discarded data,
  deliberately not used to tune anything. Every claim above about the
  *mechanism* being correct is verified against fixtures and synthetic data;
  claims about real-world *accuracy* have to wait for the sensor to come
  back online.
- **The autoregressive forecast loop is capped, not replaced.** It still
  compounds toward a fixed point past the 12-hour cap; a direct
  multi-horizon output head is the planned real fix.
- **The half-hour weather mapping is a step function by deliberate choice**,
  not a limitation to fix — see [Weather](#weather) for the reasoning.
  Linear interpolation of temperature alone is a possible future refinement.
- **Quiet-vs-sensor-down detection is a heuristic** (no `raw_events` within a
  symmetric 2-hour window during opening hours), because the Jetson firmware
  does not currently emit a fixed-interval heartbeat. This can misclassify an
  ordinary quiet stretch as an outage, and vice versa near the edges of a
  real one. The clean fix is a firmware change (a different repository) that
  posts on a fixed interval regardless of counts, including all-zero
  payloads — until then, this heuristic is what distinguishes them.

---

## Prerequisites

- **Docker Engine ≥ 24.0** and **Docker Compose V2** (`docker compose`, not `docker-compose`)
- Outbound internet access (Open-Meteo, Nager.Date)
- TLS certificate for production (Let's Encrypt recommended — see below)

---

## Production Deployment on Linux Server

### 1. Clone the repository

```bash
git clone <repo-url> /opt/library-occupancy
cd /opt/library-occupancy
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in every value. Generate secrets with:

```bash
# JWT secrets
openssl rand -hex 64   # for JWT_SECRET
openssl rand -hex 64   # for JWT_REFRESH_SECRET

# Jetson API key
openssl rand -hex 32   # for JETSON_API_KEY

# ML internal secret
openssl rand -hex 32   # for ML_SECRET
```

Set `LIBRARY_LAT` / `LIBRARY_LON` to your library's GPS coordinates.
Set `CORS_ORIGIN` to your production dashboard URL.
Set `NEXT_PUBLIC_API_URL` to the public-facing API URL (e.g. `https://your-domain.com`),
as the browser calls the API directly — no Next.js proxy involved.

### 3. Place TLS certificates

```bash
mkdir -p nginx/certs
# Copy your fullchain.pem and privkey.pem here:
cp /etc/letsencrypt/live/your-domain/fullchain.pem nginx/certs/
cp /etc/letsencrypt/live/your-domain/privkey.pem   nginx/certs/
chmod 600 nginx/certs/*.pem
```

Or with Certbot:
```bash
certbot certonly --standalone -d your-domain.com
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/certs/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem   nginx/certs/
```

### 4. Build and start

```bash
docker compose build
docker compose up -d
```

First start: the PostgreSQL container automatically runs all `db/init/*.sql`
files to create the schema and seed default config. This only happens on a
brand-new, empty data volume — see [Migrations](#migrations) for how to
apply schema changes to a deployment that's already running.

### 5. Create the first admin user

```bash
docker compose exec api node src/scripts/createUser.js
```

Enter a username and password (min 8 characters). You can re-run this to
change a password.

### 6. Verify everything is running

```bash
docker compose ps
docker compose logs --tail=50 api
docker compose logs --tail=50 ml
```

Visit `https://your-domain.com` — you should see the login page.

### 7. Configure the Jetson device

Program the Jetson to send POST requests:

```
POST https://your-domain.com/api/v1/ingest/jetson/occupancy
Authorization: Bearer <JETSON_API_KEY>
Content-Type: application/json

{
  "device_id": "jetson-orin-01",
  "event_time": "2025-11-15T10:22:00Z",
  "entries": 3,
  "exits": 1
}
```

### 8. Embed the public widget

Add to any HTML page on the library website:

```html
<iframe
  src="https://your-domain.com/widget"
  width="400"
  height="350"
  frameborder="0"
  loading="lazy"
  title="Bibliothek Auslastung">
</iframe>
```

---

## Development Environment

The dev setup uses `docker-compose.override.yml` which:
- Skips nginx (no TLS needed)
- Mounts source directories as volumes for hot-reload
- Exposes the database on `localhost:5432`
- Runs Next.js in dev mode

### 1. Clone and configure

```bash
cp .env.example .env
```

Edit `.env`, set:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://library_app:change_me@localhost:5432/library_occupancy
```

> `NEXT_PUBLIC_API_URL` is required — the browser calls the API directly at this
> address. The Next.js dev server does **not** proxy `/api/*` requests.

### 2. Start all services

```bash
docker compose up --build
```

The override file is picked up automatically.

### 3. Access the services

| Service         | URL                            |
|-----------------|--------------------------------|
| Dashboard       | http://localhost:3000          |
| Public Widget   | http://localhost:3000/widget   |
| API             | http://localhost:3001          |
| ML Service      | http://localhost:3002          |
| PostgreSQL      | localhost:5432                 |

### 4. Create a dev admin user

```bash
docker compose exec api node src/scripts/createUser.js
```

### 5. Test the Jetson webhook

```bash
curl -X POST http://localhost:3001/api/v1/ingest/jetson/occupancy \
  -H "Authorization: Bearer $(grep JETSON_API_KEY .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"device_id":"jetson-test","event_time":"2025-01-15T10:00:00Z","entries":5,"exits":2}'
```

### 6. Trigger a manual model retrain (dev)

```bash
curl -X POST http://localhost:3002/retrain \
  -H "X-ML-Secret: $(grep ML_SECRET .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Environment Variables Reference

| Variable              | Required | Description |
|-----------------------|----------|-------------|
| `POSTGRES_DB`         | Yes      | Database name |
| `POSTGRES_USER`       | Yes      | Database user |
| `POSTGRES_PASSWORD`   | Yes      | Database password |
| `DATABASE_URL`        | Yes      | Full PostgreSQL connection string |
| `JWT_SECRET`          | Yes      | 64-byte hex secret for access tokens |
| `JWT_REFRESH_SECRET`  | Yes      | 64-byte hex secret for refresh tokens |
| `JETSON_API_KEY`      | Yes      | 32-byte hex API key for Jetson device |
| `ML_SECRET`           | Yes      | Internal secret for API↔ML communication |
| `ML_SERVICE_URL`      | No       | Defaults to `http://ml:3002` |
| `CORS_ORIGIN`         | Yes      | Allowed origin for dashboard CORS |
| `NEXT_PUBLIC_API_URL` | Yes      | Public API base URL — browser calls this directly (e.g. `https://your-domain.com` in prod, `http://localhost:3001` in dev) |
| `COUNTRY_CODE`        | No       | ISO 3166-1 alpha-2 for holidays (default: `DE`) |
| `HOLIDAY_SUBDIVISION` | No       | Nager.Date subdivision code for state-level public holidays (default: `DE-BB`). Without this, holidays that aren't nationwide (e.g. Reformationstag) are silently missed — a country-level-only query can never catch a state holiday. |
| `OPEN_METEO_HISTORICAL_URL` | No | Open-Meteo Historical Forecast API base URL (default: `https://historical-forecast-api.open-meteo.com`) — used to backfill weather for past occupancy data. See [Weather](#weather). |
| `NODE_ENV`            | No       | `production` or `development` |

> **Note (v2.0.0):** `LIBRARY_LAT`/`LIBRARY_LON` are no longer environment
> variables — they never actually worked as one. `fetchWeather.js` has
> always read `library_lat`/`library_lon` from the `config` database table,
> not from these env vars, so setting them had no effect. The config table
> is the real source of truth (see [Config Keys](#config-keys)); the seeded
> default was also wrong (48.1372/11.5755 is Munich) and is now corrected to
> TH Brandenburg's approximate coordinates (52.41/12.55).

---

## Scheduled Jobs

| Schedule (Europe/Berlin) | Job | Action |
|--------------------------|-----|--------|
| Every hour at :05         | fetchWeather | Fetch 8-day forward forecast from Open-Meteo (`source='forecast'`) |
| Every hour at :10         | generateForecasts | Generate predictions via ML (LSTM if eligible, else seasonal baseline, else nothing — see [Forecasting](#forecasting)) |
| Daily at 00:10            | backupDatabase | Export every table except `users` to CSV under `db/backups/<timestamp>/`, then prune backup folders older than 30 days — see [Backup](#backup) |
| Daily at 00:15            | aggregateIntervals | Finalize every 30-min slot since the last run — including closed and quiet hours — deriving `is_open`/`period_type` from the calendar, `is_holiday` from Nager.Date, and weather from historical data only |
| Daily at 00:20            | fetchWeatherHistorical | Fetch settled historical weather (`source='historical'`) and retry backfilling any interval still waiting on the archive |
| Daily at 00:25            | checkTrainingReadiness | Check whether enough valid contiguous data now exists to train (same window-counting logic as train time); notify via dashboard banner + optional webhook once per readiness episode |
| Daily at 00:30            | cleanup | Delete raw events older than 6 months and forward-forecast weather rows older than 10 days (historical rows are never pruned) |
| 1st of month at 02:00     | monthlyRetrain | Retrain the ML model, gated on valid contiguous windows and a promotion check against the seasonal baseline — see [Forecasting](#forecasting) |

---

## Logging

Every `console.log`/`console.warn`/`console.error` call site across all three
Node services (`api`, `ml`, `scheduler`) follows the same convention:

```
[tag][ISO-8601 timestamp] message
```

e.g. `[weather][2026-07-23T14:32:10.123Z] Cached 8 days of forecast`. The
timestamp comes from a one-line `nowIso()` helper duplicated once per service
(`src/lib/logger.js` in each) rather than a shared logging framework — no
shared code path exists between the three services, and a single mechanical
`new Date().toISOString()` call needs nothing heavier. This matters most when
reading `docker compose logs`, which interleaves output from all five
containers with no per-line time reference of its own:

```bash
docker compose logs -f --tail=100 scheduler ml api
```

---

## Updating

```bash
git pull
docker compose build
docker compose up -d
docker compose exec -T db sh < db/migrate.sh
```

> **Migrations (v2.0.0):** the README previously claimed the schema uses
> `CREATE TABLE IF NOT EXISTS` needing no migration tool — that was never
> actually true (`db/init/001_schema.sql` uses plain `CREATE TABLE`) and,
> more importantly, **`db/init/*.sql` only runs automatically on a brand-new,
> empty database volume** (standard Postgres `docker-entrypoint-initdb.d`
> behavior). On any existing deployment those scripts never re-run, so
> schema changes need an explicit step. See [Migrations](#migrations).

---

## Backup

### Automated daily CSV export (v2.1.0)

The scheduler's `backupDatabase` job (daily at 00:10 Europe/Berlin) exports
every table except `users` — `raw_events`, `occupancy_intervals`, `forecasts`,
`model_versions`, `weather_cache`, `config`, `sensor_configs`,
`calendar_periods`, `calendar_lecture_free` — to
`db/backups/<ISO-timestamp>/<table>.csv` on the host, via the
`./db/backups:/app/backups` volume mount on the `scheduler` service. Backup
folders older than 30 days are pruned automatically on every run. `users` is
deliberately excluded: dumping password hashes into plaintext CSV files on
disk is a needless security exposure this backup doesn't need to take on, and
account recovery already has `createUser.js`.

This is a spot-checkable safety net — easy to diff or partially recover from
without needing a Postgres instance at hand — alongside, not a replacement
for, a full restorable `pg_dump` below.

### Manual full dump

Back up the PostgreSQL data volume:
```bash
docker compose exec db pg_dump -U library_app library_occupancy | gzip > backup_$(date +%F).sql.gz
```

Restore:
```bash
gunzip -c backup_2025-01-01.sql.gz | docker compose exec -T db psql -U library_app library_occupancy
```
