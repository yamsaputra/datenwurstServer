# Library Occupancy Forecasting Platform

Real-time occupancy tracking and ML-based forecasting for library spaces.
Receives people-counting data from an NVIDIA Jetson Orin Nano, stores it,
predicts future occupancy in 30-minute intervals, and exposes a protected
admin dashboard and a public embeddable widget.

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
| `NEXT_PUBLIC_API_URL` | Yes      | Public API base URL (browser-visible) |
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
