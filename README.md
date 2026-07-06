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
| v1.4.0  | 2026-07-06 | Fixed a client-side crash on `/dashboard/ml`: `ModelStatusCard.tsx` threw `toFixed is not a function` because `pg` (node-postgres) returns `NUMERIC`/`DECIMAL` columns as strings by default, not numbers — so `model_versions.mae_final`/`loss_final` (`NUMERIC(10,6)`) arrived as e.g. `"3.119192"`, and the optional-chained `.toFixed()` call still ran since a non-empty string is truthy. The same issue silently affected other `NUMERIC` columns (`predicted_occ`, `weather_temp`, `weather_precip`) in the API service too, just without crashing yet — `ForecastChart.tsx`'s `Math.round()` happens to coerce strings to numbers implicitly, unlike a direct `.toFixed()` call. Fixed at the source instead of per-component: registered a `pg` type parser for `NUMERIC` (OID 1700 → `parseFloat`) in `services/api/src/db.js`, `services/ml/src/db.js`, and `services/scheduler/src/lib/db.js`, so every service now returns real JS numbers for these columns. |
| v1.3.0  | 2026-07-06 | Fixed "Train Model" always returning a generic 500: `services/api/src/middleware/errorHandler.js` and `services/ml/src/middleware/errorHandler.js` were discarding `err.message` for every 5xx response, so the dashboard never saw the real failure. The actual cause was `/app/models` being owned by `root` in the `ml` container while the process runs as the non-root `node` user (`services/ml/Dockerfile`), so `model.save()` failed with `EACCES`; fixed by chowning the directory to `node` at build time. Also gave the "Not enough data to train" guard in `trainModel.js` a proper `400` status, and replaced a non-functional `node-fetch` v3 `timeout` option with `AbortSignal.timeout()` in `mlClient.js`. **Known issue found while investigating, not yet fixed:** `services/scheduler/src/jobs/aggregateIntervals.js` (daily cron at 00:15 Europe/Berlin) is supposed to close finished `occupancy_intervals` rows and backfill `weather_temp`/`weather_precip`/`weather_code`/`is_holiday`/`is_semester`, but on the VM every interval stays `is_open = TRUE` with null weather columns days after the fact, even though `weather_cache` itself is populated correctly — real contextual signal never reaches the ML pipeline. Needs its own investigation (scheduler container health/logs). |
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
files to create the schema and seed default config.

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
| `LIBRARY_LAT`         | Yes      | Library latitude for weather |
| `LIBRARY_LON`         | Yes      | Library longitude for weather |
| `NODE_ENV`            | No       | `production` or `development` |

---

## Scheduled Jobs

| Schedule (Europe/Berlin) | Job | Action |
|--------------------------|-----|--------|
| Every hour at :05         | fetchWeather | Fetch 8-day forecast from Open-Meteo |
| Every hour at :10         | generateForecasts | Generate 7-day predictions via ML |
| Daily at 00:15            | aggregateIntervals | Close & enrich 30-min intervals |
| Daily at 00:30            | cleanup | Delete events older than 6 months |
| 1st of month at 02:00     | monthlyRetrain | Retrain ML model on last 12 months |

---

## Updating

```bash
git pull
docker compose build
docker compose up -d
```

The database schema uses `CREATE TABLE IF NOT EXISTS` — no migration tool required.

---

## Backup

Back up the PostgreSQL data volume:
```bash
docker compose exec db pg_dump -U library_app library_occupancy | gzip > backup_$(date +%F).sql.gz
```

Restore:
```bash
gunzip -c backup_2025-01-01.sql.gz | docker compose exec -T db psql -U library_app library_occupancy
```
