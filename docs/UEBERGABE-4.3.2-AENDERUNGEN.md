# Change Report — Handover Document Section 4.3.2 (Serverplattform)

**Purpose.** This report documents what changed in the `datenwurstServer`
codebase during the 2026-07 correctness overhaul (aggregation, calendar,
weather, `is_open` semantics, training/forecasting, schema/migrations,
sensor provenance) as it affects Section 4.3.2 "Serverplattform" of
`Übergabedokument_bib.docx` (TH Brandenburg, dated 2026-07-16, "Arbeitsversion
/ Übergabedokument"). Structure mirrors the document's 21 subsections so
content can be pasted directly into the .docx.

**Evidence basis.**
- Source document: read in full from `C:\Users\User\Desktop\Übergabedokument_bib.docx`,
  extracted via its `word/document.xml` (Word's XML container format) since
  it cannot be opened as plain text. All quotes below are sourced from that
  extraction, not from paraphrase.
- Code: every file cited was opened fresh during this pass (not recalled
  from an earlier session's summary).
- Database: queried live against the **local development Docker Compose
  stack** running on this machine (5 containers) — **not** the production VM
  at `bibiot.th-brandenburg.de`, which is unreachable from this environment.
  Every DB-derived figure below is a dev-stack figure, labeled as such.
- Git: `HEAD` is commit `ccc1530`. `git status`/`git diff --stat HEAD` show
  **the entire overhaul — 43 modified + 34 untracked files, 1,338
  insertions / 271 deletions — has never been committed.** This is itself
  the single most important fact in this report; see Part 8.

**Register.** Factual, no marketing language, per the task's ground rules.
German replacement passages are marked **"Ersetzungstext (Deutsch):"** and
are meant to be pasted as-is; everything else (headings, evidence, status
tags) is English commentary for whoever applies the edit.

---

## Part 1 — Section-by-section changes

### 4.3.2.1 Repositorium — **UNCHANGED**

Repo URL (`github.com/yamsaputra/datenwurstServer`) and the 7-component list
(Next.js frontend, Express API, PostgreSQL, ML service, scheduler, nginx,
embeddable widget) are all still accurate. No component was added, renamed,
or removed by the overhaul.

### 4.3.2.2 Datenfluss zum Server — **UNCHANGED**

The one-paragraph description (VM + Docker Compose app: db/api/ml/scheduler/
frontend/reverse proxy) remains structurally accurate.

### 4.3.2.3 Technische Daten der VM — **UNCHANGED**

Hardware/OS/kernel/virtualization facts about the production VM
(`bibiot.th-brandenburg.de`) are outside this overhaul's scope entirely —
nothing in the 43 changed files touches VM-level configuration. Not
independently re-verified against the real VM (unreachable from this
environment, per the evidence-basis note above), but nothing gives reason to
expect it changed.

### 4.3.2.4 Verantwortliche Personen — **UNCHANGED**

Personnel/role assignment, not a code fact.

### 4.3.2.5 Installationspfad und Codestand — **NEEDS UPDATE**

*Current text:* "Produktiv wird der Branch main eingesetzt; der dokumentierte
Stand entspricht Version v0.4.0 (06.07.2026). Bei jedem Update wird der
ausgecheckte Commit mit `git log -1` im Betriebsprotokoll festgehalten."

*Evidence:* `git log --oneline -40` (this checkout) shows `HEAD` at `ccc1530`,
predating the overhaul entirely. `git status` shows 43 modified + 34
untracked files — **none of Round 1 (schema/calendar/aggregation/weather/
training/forecasting rewrite) or Round 2 (automated backups, training-
readiness notification, ISO 8601 logging) has been committed.** `README.md`'s
own internal changelog (a different numbering scheme from the document's
"vX.Y.Z (date)") currently shows `v2.1.0` (2026-07-23) as its newest entry,
but that number exists only in an uncommitted working-tree file — there is no
corresponding commit or tag `git log -1` could report.

*Replacement:* This section cannot honestly be updated with a new version
number yet, because there isn't one — the code has changed enormously but
none of it has been committed or pushed. The replacement text must say this
plainly rather than inventing a version number, and must instruct that the
overhaul be committed, pushed, and tagged before this section is next
updated.

**Ersetzungstext (Deutsch):**

> Der produktive Installationspfad lautet weiterhin `/opt/datenwurst`;
> produktiv wird weiterhin der Branch `main` eingesetzt. **Wichtiger Hinweis
> zum Übergabezeitpunkt:** Der in diesem Dokument beschriebene Korrektheits-
> Umbau (Aggregation, Kalender, Wetterdaten, Prognosemodell, Datenbankschema,
> Sensor-Historie) liegt zum Zeitpunkt der Erstellung dieses Änderungsberichts
> ausschließlich als unversionierter Arbeitsstand in einem einzelnen lokalen
> Checkout vor — er wurde **nicht committet und nicht auf das Repository
> gepusht**. Der zuletzt dokumentierte Stand `v0.4.0 (06.07.2026)` ist damit
> veraltet, ein neuer, gültiger Versionsstand kann jedoch erst benannt werden,
> nachdem der Umbau tatsächlich committet, gepusht und auf dem Server
> ausgerollt wurde. Bis dahin sollte `git log -1` auf dem Server weiterhin den
> alten Stand `v0.4.0` zeigen — stimmt der tatsächlich laufende Code damit
> nicht überein, ist dies ein Hinweis darauf, dass ein Rollout ohne
> Versionskontrolle erfolgt ist, und sollte geklärt werden, bevor produktiv
> weitergearbeitet wird. Nach jedem künftigen Update gilt weiterhin: der
> ausgecheckte Commit wird mit `git log -1` im Betriebsprotokoll festgehalten.

### 4.3.2.6 Konfiguration über Umgebungsvariablen (.env) — **NEEDS UPDATE**

*Current text:* 17-variable list (`POSTGRES_DB` … `NODE_ENV`), no
`HOLIDAY_SUBDIVISION`, no `OPEN_METEO_HISTORICAL_URL`, includes
`LIBRARY_LAT`/`LIBRARY_LON`.

*Evidence:* `.env.example` (repo root) now lists `HOLIDAY_SUBDIVISION`
(default `DE-BB`, comment: needed because Nager.Date's country-level check
alone misses state-specific holidays like Reformationstag) and
`OPEN_METEO_HISTORICAL_URL` (default `https://historical-forecast-api.open-meteo.com`,
comment: backfills historical weather with the same distribution the model
sees from live forecasts at inference time — deliberately not the
Archive/ERA5 API). `LIBRARY_LAT`/`LIBRARY_LON` are **gone from `.env.example`
entirely**, replaced by a comment explaining they never actually worked as
env vars — `fetchWeather.js` has always read `library_lat`/`library_lon`
from the `config` database table, so setting the env var had no effect;
confirmed unchanged by re-reading `fetchWeather.js` this pass.
`docker-compose.yml` matches: `HOLIDAY_SUBDIVISION`/`OPEN_METEO_HISTORICAL_URL`
present (lines 59, 62 in the `scheduler` service block), no
`LIBRARY_LAT`/`LIBRARY_LON` anywhere in the file (grepped).

Also confirmed live (`config` table, dev DB): `library_lat=52.41`,
`library_lon=12.55` — corrected from the old seed default of
`48.1372`/`11.5755` (Munich), which was wrong for TH Brandenburg. This
correction lives in `db/init/011_config_keys.sql` as an **unconditional
`UPDATE ... WHERE key = 'library_lat'`** (and same for `library_lon`), so
it correctly overwrites the wrong value even on an existing production
database that already has these keys seeded — confirmed by reading the
migration directly; this is not a gap. The three genuinely new config keys
in the same file (`ml.min_training_windows`, `ml.min_baseline_days`,
`capacity_label`) correctly use `INSERT ... ON CONFLICT DO NOTHING`
instead, appropriate since those never had a prior value to overwrite.

Both wrong cross-references to "Abschnitt 4.3.2.6 (Aggregationsproblematik)"
that currently point here are addressed in Part 2, not repeated here.

*Replacement:*

**Ersetzungstext (Deutsch):**

> Die Anwendung wird weiterhin über eine zentrale `.env`-Datei im
> Installationsverzeichnis konfiguriert. Gegenüber dem bisherigen Stand kamen
> zwei Variablen hinzu, zwei entfielen ersatzlos:
>
> **Neu:**
> - `HOLIDAY_SUBDIVISION` (Standardwert `DE-BB`) — legt fest, für welches
>   Bundesland länderspezifische Feiertage (z. B. Reformationstag) zusätzlich
>   zu bundesweiten Feiertagen berücksichtigt werden. Ohne diese Variable
>   würden solche Feiertage stillschweigend nicht als Schließtag erkannt.
> - `OPEN_METEO_HISTORICAL_URL` (Standardwert
>   `https://historical-forecast-api.open-meteo.com`) — Adresse der
>   Open-Meteo-Schnittstelle, über die historische Wetterdaten für bereits
>   vergangene Belegungsdaten nachträglich ergänzt werden (siehe Abschnitt
>   „Wetterdaten").
>
> **Entfallen:** `LIBRARY_LAT` und `LIBRARY_LON` sind keine Umgebungsvariablen
> mehr. Sie hatten schon vorher keine Wirkung — die Koordinaten werden
> ausschließlich aus der Datenbank-Konfigurationstabelle gelesen, änderbar
> über das Dashboard, ohne Neustart des Servers. Der zuvor dort hinterlegte
> Standardwert (48,1372° / 11,5755° — München) war zudem fachlich falsch und
> wurde auf die ungefähre Lage der Technischen Hochschule Brandenburg
> (52,41° / 12,55°) korrigiert.
>
> Die Geheimwerte (JWT-Secrets, Jetson-API-Key, ML-Secret) werden weiterhin
> mit `openssl rand -hex` erzeugt und ausschließlich in der `.env`-Datei auf
> dem Server sowie in der internen Zugangsdatenverwaltung abgelegt.

### 4.3.2.7 Netzwerkarchitektur und Erreichbarkeit — **UNCHANGED**

VPN/Tailscale topology, admin-dashboard/ML-dashboard addresses, and the
public-widget-only exposure model are all unaffected. The two genuinely new
server-side routes this overhaul adds (`GET /training-readiness` on the `ml`
service, `GET /forecasts/meta` addition on the `api` service's existing
`dashboard` router) don't change the exposure picture: `ml` still has no
external port (confirmed in `docker-compose.yml` — no `ports:` block on the
`ml` service, matching the document's own service table), and
`/forecasts/meta` sits inside the already-JWT-protected `dashboard` router,
not newly public.

### 4.3.2.8 TLS-Zertifikat und Verlängerung — **UNCHANGED**

Tailscale-issued certificates and automatic renewal are untouched by this
overhaul.

### 4.3.2.9 Datenbank und Docker-Volumes — **NEEDS UPDATE**

*Current text:* "belegt derzeit rund 64 MB (Stand: Juli 2026). Da
Rohereignisse nach sechs Monaten automatisch bereinigt werden und die
aggregierten 30-Minuten-Intervalle nur wenig Speicher benötigen, ist das
Datenwachstum gering."

*Evidence (dev stack, live query):* Ten tables now exist where the original
schema had seven — `information_schema.columns` (queried live) confirms
`schema_migrations`, `sensor_configs`, `calendar_periods`,
`calendar_lecture_free` are new, and `occupancy_intervals`/`model_versions`/
`forecasts`/`weather_cache` all gained columns (`is_finalized`, `data_status`,
`period_type`, `clamped`, `weather_backfilled`, `sensor_config_id` on
`occupancy_intervals`; `status`, `valid_windows`, `holdout_mae`,
`baseline_mae`, `skip_reason`, `feature_count`, `sensor_config_ids` on
`model_versions`; `source` on both `forecasts` and `weather_cache`).
`schema_migrations` (10 rows, live query) tracks which of the 10 new
migrations have run.

This dev database currently totals **8,823 kB** (`pg_database_size`),
`raw_events`=148 rows, `occupancy_intervals`=54 rows, `forecasts`=336,
`model_versions`=6, `weather_cache`=19, `sensor_configs`=1 — this is a small,
recently-reset development dataset, **not** a substitute for the production
VM's real figure, which is unreachable from here.

The six-month `raw_events` cleanup rule is confirmed **unchanged**
(`cleanup.js`, re-read this pass: still
`DELETE FROM raw_events WHERE event_time < NOW() - INTERVAL '6 months'`,
unconditional). The claim that aggregated intervals "need little space" and
grow slowly needs a caveat, though: **before** this overhaul, a row was only
ever written when a real sensor event arrived — an idle period produced no
rows at all. **After** this overhaul, `aggregateIntervals.js` writes a row
for **every** 30-minute slot, open or closed, quiet or busy — a fixed 48
rows/day regardless of activity, where before it could be far fewer.
Occupancy-interval row growth is now bounded and predictable, but per unit
time it is likely **higher**, not lower, than before.

*Replacement:*

**Ersetzungstext (Deutsch):**

> Die Datenbank liegt weiterhin im Docker-Volume `datenwurst_db_data`. Das
> Datenmodell wurde um vier neue Tabellen erweitert
> (`schema_migrations` — Nachverfolgung angewandter Schemaänderungen;
> `sensor_configs` — physische Sensor-Historie, siehe eigener Abschnitt;
> `calendar_periods`/`calendar_lecture_free` — der Semesterkalender als Daten,
> siehe eigener Abschnitt) sowie um mehrere neue Spalten in den bestehenden
> Tabellen für Auslastungsintervalle, Modellversionen, Prognosen und
> Wetterdaten.
>
> Die automatische Löschung der Rohereignisse nach sechs Monaten gilt
> unverändert fort. Bei den aggregierten 30-Minuten-Intervallen hat sich die
> Wachstumscharakteristik jedoch geändert: Zuvor wurde nur bei einem
> tatsächlichen Zählereignis eine Zeile geschrieben: ruhige Zeiträume
> erzeugten schlicht keinen Eintrag. Seit dem Umbau wird für **jedes**
> 30-Minuten-Intervall ein Eintrag geschrieben — geöffnet oder geschlossen,
> mit oder ohne Bewegung —, also grundsätzlich 48 Zeilen pro Tag. Das macht
> das Datenwachstum vorhersagbarer, aber tendenziell **größer** als zuvor, da
> es jetzt unabhängig von der tatsächlichen Aktivität ist. Bei weiterhin sehr
> kompakten Zeilen (wenige Zahlen- und Wahrheitswerte je Zeile) bleibt der
> Speicherbedarf auch bei durchgehendem Betrieb voraussichtlich niedrig
> (Größenordnung einige zehn MB pro Betriebsjahr), sollte aber nach den
> ersten Monaten realer Nutzung einmal überprüft werden.

### 4.3.2.10 Log-Verwaltung und Aufbewahrung — **NEEDS UPDATE**

*Current text:* json-file driver, `docker compose logs --tail=50 <dienst>`,
"Aufbewahrung je Dienst auf drei Dateien zu je 10 MB begrenzt."

*Evidence:* `docker-compose.yml` was grepped for a `logging:` block — **none
exists.** No per-service log-rotation configuration is defined anywhere in
this repository. If the "3 files × 10 MB" rotation genuinely applies on the
production VM, it must be configured at the Docker **daemon** level (e.g.
`/etc/docker/daemon.json`), outside this repository, and could not be
verified from here. This predates the overhaul (nothing in the 43 changed
files touches logging configuration) — noted here only because this
subsection is being touched anyway for the timestamp change below.

New this overhaul: every `console.log`/`console.warn`/`console.error` call
site in all three Node services (86 call sites across 28 files, confirmed
by grep — zero remaining without a timestamp) now includes an ISO 8601
timestamp: `[tag][2026-07-23T14:32:10.123Z] message`, via a one-line
`nowIso()` helper duplicated once per service
(`services/*/src/lib/logger.js`). Confirmed live:
`docker compose logs --tail=5 scheduler ml api` shows e.g.
`scheduler-1 | [weather][2026-07-23T12:23:07.479Z] Cached 8 days of forecast`.

*Replacement:*

**Ersetzungstext (Deutsch):**

> Die Container-Logs werden weiterhin über den Docker-Standardtreiber
> (`json-file`) geschrieben und mit `docker compose logs --tail=50 <dienst>`
> eingesehen. **Neu:** Jede Log-Zeile aller drei Node.js-Dienste (API, ML,
> Scheduler) beginnt nun mit einem Zeitstempel im ISO-8601-Format, z. B.
> `[weather][2026-07-23T12:23:07.479Z] Cached 8 days of forecast`. Das
> erleichtert die Fehlersuche insbesondere bei `docker compose logs`, das die
> Ausgaben mehrerer Container ohne eigenen Zeitbezug ineinander mischt.
>
> Die im vorherigen Dokumentstand genannte Begrenzung auf drei Dateien zu je
> 10 MB je Dienst konnte in der Docker-Compose-Konfiguration dieses
> Repositories nicht bestätigt werden — dort ist keine Log-Rotation
> hinterlegt. Sollte diese Begrenzung auf dem Produktivserver tatsächlich
> greifen, ist sie vermutlich auf Ebene des Docker-Daemons konfiguriert
> (außerhalb dieses Repositories) und sollte dort einmal geprüft werden
> (`cat /etc/docker/daemon.json` auf der VM).

### 4.3.2.11 Monitoring und Benachrichtigungen — **NEEDS UPDATE**

*Current text:* `restart: unless-stopped`, weekly manual `docker compose ps`
+ visual dashboard/widget check, anomalies logged manually.

*Evidence:* All of the above remains true and unchanged (grepped
`docker-compose.yml`, no `restart:` policy change). New this overhaul, and
staying within the document's own "deliberately lean, no extra
infrastructure" framing: a daily job (`checkTrainingReadiness.js`, 00:25
Europe/Berlin) checks whether enough contiguous data now exists to attempt
training, using the same window-counting logic training itself uses (not a
day-count proxy — confirmed by reading `trainingReadiness.js`, which reuses
`loadRows`/`splitByDayBoundary`/`buildWindows` read-only). The first time
this becomes true, it (a) shows a persistent banner on `/dashboard/ml` and
(b) optionally POSTs to a configured webhook URL
(`notifications.webhook_url` in the `config` table, `null` by default —
confirmed live, currently `null` in the dev DB). Verified live this pass:
`ml.last_readiness_check` in the `config` table holds a real cached result
(`{"ready": false, "validWindows": 0, "minTrainingWindows": 2000, ...}`),
and `GET /training-readiness` on the `ml` service returns the identical
figures live.

*Replacement:*

**Ersetzungstext (Deutsch):**

> Das Monitoring-Konzept bleibt bewusst schlank: Docker-Restart-Policy
> „unless-stopped", wöchentliche Sichtprüfung (`docker compose ps` sowie
> Dashboard/Widget), Auffälligkeiten werden manuell im Betriebsprotokoll
> vermerkt. **Neu hinzugekommen, ohne zusätzliche Infrastruktur:** Ein
> täglicher Hintergrundjob prüft, ob inzwischen genügend zusammenhängende
> Belegungsdaten für ein sinnvolles Training vorliegen. Ist das erstmals der
> Fall, erscheint ein dauerhafter Hinweis auf der ML-Seite des Dashboards;
> zusätzlich kann optional eine Webhook-Adresse hinterlegt werden
> (Konfigurationsschlüssel `notifications.webhook_url`, standardmäßig nicht
> gesetzt), an die einmalig eine Benachrichtigung gesendet wird. Diese
> Benachrichtigung wird erst nach dem nächsten tatsächlichen Trainingsversuch
> zurückgesetzt, meldet sich bei fortbestehendem Datenzuwachs also nicht
> wiederholt.

### 4.3.2.12 Anlage und Änderung von Admin-Benutzern — **UNCHANGED**

`createUser.js` re-read this pass: identical behavior (interactive
username/password prompt, bcrypt hash, re-run with an existing username
changes that user's password). Only change is the addition of an ISO 8601
timestamp to its two log lines — cosmetic, not behavioral.

### 4.3.2.13 Aktualisierung des Servers — **NEEDS UPDATE** (highest priority)

*Current text:* `cd /opt/datenwurst` → `git status` → `git pull` →
`docker compose up -d --build` → `docker compose ps`.

*Evidence:* Confirmed directly (`db/migrate.sh`, re-read this pass):
`db/init/*.sql` only runs via Postgres's own `docker-entrypoint-initdb.d`
mechanism, which **only ever executes once, against a brand-new, empty data
volume.** Any server that already has data — every real production
deployment after its first boot — never re-runs these files on a plain
`docker compose up -d --build`. The command sequence in the document is
missing the one step that actually applies schema changes to a running
database. Running it as documented today would silently leave the schema
unchanged while the application code (which now expects the new columns)
starts up — this is exactly what happened when this overhaul was first
deployed to the development database, causing 500 errors on `/ml/status`
and `/dashboard/forecasts/meta` until the missing step was run manually.

Verified idempotency of the fix this pass: `docker compose exec -T db sh <
db/migrate.sh` run a second time against the dev DB reported
`migrate.sh: nothing to do, all migrations already applied` for all 10
migrations, with **zero errors** — safe to run on every update regardless of
whether anything is actually pending.

*Replacement:*

**Ersetzungstext (Deutsch):**

> **Dieser Abschnitt ist der operativ wichtigste im gesamten Dokument — eine
> unvollständige Fassung führt zu echten Ausfällen.** Der bisher
> dokumentierte Ablauf enthält keinen Schritt zur Anwendung von
> Datenbankschema-Änderungen. Das ist kein Versehen der bisherigen
> Dokumentation, sondern eine technische Tatsache: `db/init/*.sql` wird von
> PostgreSQL ausschließlich beim allerersten Start auf einem **leeren**
> Datenvolume automatisch ausgeführt. Jeder Server, der bereits Daten
> enthält — also jede reale Produktivinstallation nach der Erstinbetriebnahme —
> führt diese Dateien bei einem gewöhnlichen `docker compose up -d --build`
> **nicht erneut aus**. Der vollständige, geprüfte Ablauf für ein Update
> lautet:
>
> ```bash
> cd /opt/datenwurst
> git status
> git pull
> docker compose exec db pg_dump -U <POSTGRES_USER> <POSTGRES_DB> | gzip > backups/backup_$(date +%F).sql.gz
> docker compose up -d --build
> docker compose exec -T db sh < db/migrate.sh
> docker compose ps
> git log -1
> ```
>
> Der neue Schritt `docker compose exec -T db sh < db/migrate.sh` wendet alle
> noch ausstehenden Schemaänderungen an und protokolliert jede angewandte
> Datei einzeln. Er ist gefahrlos wiederholt ausführbar: bereits angewandte
> Änderungen werden übersprungen, ein zweiter Aufruf ohne ausstehende
> Änderungen meldet lediglich „nothing to do". Nach dem Update sollte die
> Ausgabe von `docker compose logs --tail=20 api ml scheduler` geprüft
> werden — insbesondere auf wiederholte Fehlermeldungen, die auf eine noch
> nicht angewandte Migration hindeuten würden (z. B. „column ... does not
> exist"). Das Datenbankbackup vor dem Update (siehe Abschnitt „Backups")
> bleibt unverändert Pflicht.

### 4.3.2.14 Backups und Wiederherstellung — **NEEDS UPDATE**

*Current text:* Daily 01:00 cron, `pg_dump`-style full database backup to
`/opt/datenwurst/backups`, weekly copy to Hochschulspeicher, 14-day
retention, gpg for off-VM copies, semi-annual restore test.

*Evidence:* This full-database backup mechanism is **not changed** by the
overhaul and should stay exactly as documented — it remains the only
mechanism that can fully restore the database. New this overhaul, as an
**additional, narrower safety net, not a replacement**: a daily scheduled
job (`backupDatabase.js`, 00:10 Europe/Berlin) exports every table except
`users` to per-table CSV files under `db/backups/<ISO-timestamp>/`,
mounted from the `scheduler` container to the host via
`./db/backups:/app/backups` (confirmed in `docker-compose.yml`) — on the
production install path this resolves to `/opt/datenwurst/db/backups/`.
`users` is excluded deliberately (re-read `backupDatabase.js` this pass):
writing password hashes into plaintext CSV files is an avoidable exposure;
account recovery already has `createUser.js`. Retention for this CSV export
is **30 days**, pruned automatically on every run — a different number from
the existing 14-day full-backup retention; both apply, to different backup
mechanisms, and should not be conflated.

*Replacement:*

**Ersetzungstext (Deutsch):**

> Das bestehende Backupkonzept (täglich 01:00 Uhr, vollständiger
> Datenbank-Dump nach `/opt/datenwurst/backups`, wöchentliche Kopie auf den
> Hochschulspeicher, 14 Tage Aufbewahrung, `gpg`-Verschlüsselung für externe
> Kopien, halbjährlicher Restore-Test) bleibt unverändert die maßgebliche
> Absicherung für eine vollständige Wiederherstellung.
>
> **Zusätzlich, nicht als Ersatz:** Ein täglicher automatischer Exportjob
> (00:10 Uhr) schreibt jede fachliche Tabelle außer der Benutzertabelle als
> einzelne CSV-Datei nach `/opt/datenwurst/db/backups/<Zeitstempel>/`. Diese
> CSV-Exporte werden automatisch nach 30 Tagen gelöscht — eine andere
> Aufbewahrungsfrist als beim vollständigen Datenbank-Dump. Die
> Benutzertabelle wird bewusst ausgeschlossen, da sie Passwort-Hashes enthält
> und eine Zurücksetzung ohnehin über das vorhandene Administrationsskript
> möglich ist. Der CSV-Export eignet sich zum schnellen Nachsehen oder
> teilweisen Wiederherstellen einzelner Tabellen ohne laufende
> PostgreSQL-Instanz, ersetzt aber nicht den vollständigen Dump als
> Grundlage für eine komplette Wiederherstellung.

### 4.3.2.15 Widget — **NEEDS UPDATE**

*Current text:* iframe snippet (400×350), checklist table including
"Kapazitätswert: Als Kapazität sind 60 Plätze hinterlegt."

*Evidence:* The iframe embed code and its 400×350 sizing are unchanged
(re-read `widget/page.tsx` this pass — no dimension/embedding change). The
widget's own text confirms three distinct states corresponding to
`active_source` (`widget/page.tsx`, re-read this pass): `'lstm'` → label
"Modellprognose"; `'baseline'` → label "typische Auslastung"; and
`'collecting_data'` → **no chart at all**, text "Es werden noch Daten
gesammelt — eine Prognose liegt noch nicht vor." confirmed live this pass
via `curl http://localhost:3001/api/v1/public/widget`, which currently
returns exactly `active_source: "collecting_data"` on this dev stack.

**On the capacity figure specifically:** the live `config` table on this
dev stack currently holds `max_occupancy = 150`, not 60. Tracing this back:
`db/init/003_seed.sql` (an original bootstrap file, untouched by this
overhaul, predating it entirely) has always seeded `150` — this mismatch
between the document's "60 Plätze" and the codebase's seeded default is not
something this overhaul introduced or changed. If the production dashboard's
actually-configured value is genuinely 60 (set once via `PUT
/dashboard/config` after deployment, which never touches the seed file),
this dev checkout simply never received that same manual configuration —
this could not be verified against production from here. Recommend the
incoming maintainers confirm the real production value directly (dashboard
config screen, or the widget's own `max_occupancy` field) before treating
either number as authoritative.

*Replacement:*

**Ersetzungstext (Deutsch):**

> Der iFrame-Einbettungscode und die Zielgröße (400 × 350 px) sind
> unverändert. Neu zeigt das Widget nun erkennbar an, auf welcher Grundlage
> die Prognose beruht: „Modellprognose" (trainiertes Vorhersagemodell aktiv),
> „typische Auslastung" (durchschnittliche Belegung nach Wochentag und
> Uhrzeit, wenn kein Modell verfügbar ist oder keines die Baseline schlägt),
> oder — wenn noch keines von beidem möglich ist — ein Hinweistext ohne
> Zahlenwert („Es werden noch Daten gesammelt — eine Prognose liegt noch
> nicht vor."), damit kein irreführender Platzhalterwert angezeigt wird.
>
> **Zum Kapazitätswert:** Der in der Entwicklungsumgebung tatsächlich
> hinterlegte Wert ist 150 (Gesamtkapazität des Gebäudes) und stammt aus der
> ursprünglichen, bereits vor diesem Umbau bestehenden Grundkonfiguration —
> nicht aus einer Änderung dieses Umbaus. Sollte auf dem Produktivserver
> tatsächlich 60 (obere Lernbereich-Kapazität) hinterlegt sein, wäre dies
> eine nachträgliche, nur auf dem Produktivserver vorgenommene
> Konfigurationsänderung über das Dashboard, die in dieser
> Entwicklungsumgebung nicht nachvollzogen werden konnte. Empfehlung: den
> tatsächlich auf dem Produktivserver hinterlegten Wert einmal direkt über
> das Dashboard prüfen, bevor dieser Abschnitt final aktualisiert wird.

### 4.3.2.16 Daten und Prognosemodell — **NEEDS UPDATE**

*Current text:* Device-ID/timestamp/entries/exits → 30-minute intervals;
raw events 6 months, aggregated intervals unbounded.

*Evidence:* Data flow and retention rule both confirmed unchanged. What
needs adding, per the task's explicit ask, is the meaning of three
columns the document doesn't currently distinguish, re-confirmed by reading
`aggregateIntervals.js`, `occupancy.js`, and the live schema this pass:

- `is_open` — purely calendar-derived (semester period, holiday, day of
  week, time of day). Set once by the nightly finalization job and never
  touched again.
- `is_finalized` — whether the nightly job has closed out and enriched this
  slot yet. `false` only for the current, still-in-progress slot.
- `data_status` — `'observed'` (a real value — from an actual sensor event,
  or correctly zero because the library was closed, or correctly zero
  because the sensor was confirmed active but quiet) versus `'no_data'`
  (the sensor's state during this slot is genuinely unknown, so occupancy
  is stored as `NULL`, never a guessed zero).

These three answer different questions and must not be merged: a slot can
be closed (`is_open=false`) and still perfectly `data_status='observed'`
(occupancy is correctly zero); a slot can be open and still `'no_data'` if
the sensor was silent for over two hours during opening hours. Confirmed
with a live example this pass (2026-07-04, a Saturday under the historical
pilot data): 10:00–15:30 local shows `is_open=false` (Saturdays are always
closed under the new calendar) **and** `data_status='no_data'` (a genuine
recorded sensor outage from that period) simultaneously — two independent
facts about the same slot.

`sensor_config_id` (new column) tags every stored row to the specific
physical sensor mount that produced it — see the new "Sensorkonfiguration"
subsection (Part 4) for why this matters.

*Replacement:*

**Ersetzungstext (Deutsch):**

> Die Datenerfassung (Geräte-ID, Zeitstempel, Ein-/Austritte → 30-Minuten-
> Intervalle) und die Aufbewahrungsregelung (Rohereignisse sechs Monate,
> aggregierte Intervalle unbefristet) gelten unverändert fort.
>
> Neu hinzugekommen sind drei Kennzeichnungen je Intervall, die bewusst
> getrennt gehalten werden und **nicht zusammengeführt werden dürfen**:
>
> - **„Geöffnet" (`is_open`)** — rein kalenderbasiert: War die Bibliothek zu
>   diesem Zeitpunkt laut Semesterkalender, Feiertagsliste und Uhrzeit
>   geöffnet.
> - **„Abgeschlossen" (`is_finalized`)** — Hat der nächtliche
>   Verarbeitungsjob dieses Intervall bereits abschließend ausgewertet.
>   Nur das aktuell laufende Intervall ist noch nicht abgeschlossen.
> - **„Datenstatus" (`data_status`)** — entweder „beobachtet" (ein echter
>   Messwert liegt vor — sei es ein Zählereignis oder eine korrekt
>   ermittelte Null, weil geschlossen oder weil der Sensor nachweislich
>   aktiv, aber ruhig war) oder „keine Daten" (der Zustand des Sensors ist
>   in diesem Zeitraum schlicht unbekannt — die Belegung wird dann als
>   „unbekannt" gespeichert, niemals als geschätzte Null).
>
> Diese drei Angaben beantworten unterschiedliche Fragen und können
> unabhängig voneinander unterschiedlich ausfallen: Ein geschlossenes
> Intervall ist ganz regulär „beobachtet" (die Null-Belegung ist korrekt
> ermittelt). Ein geöffnetes Intervall kann trotzdem „keine Daten" sein, wenn
> der Sensor über zwei Stunden während der Öffnungszeit nichts gemeldet hat.
>
> Zusätzlich wird jedes gespeicherte Intervall einer konkreten physischen
> Sensormontage zugeordnet (siehe Abschnitt „Sensorkonfiguration und
> Sensor-Historie").

### 4.3.2.17 Prognosemodell: Architektur — **NEEDS UPDATE**

*Current text:* 8 timesteps × 18 features, LSTM64→LSTM32→Dense32(ReLU)→
output16 linear, Adam lr 0.001, Huber loss, MAE tracked.

*Evidence:* Re-read `buildModel.js` and `featureEncoder.js` this pass.
Architecture unchanged except the feature count: **8 timesteps × 20
features** (was 18), still LSTM64 (dropout 0.1, recurrent dropout
0.1) → LSTM32 (same dropout) → Dense32(ReLU) → Dense16(linear), Adam
lr=0.001, Huber loss, MAE tracked. The change: the old single "is semester"
boolean (feature index 9) is replaced by a three-value one-hot
(`is_lecture`/`is_exam`/`is_break`, net +2 features), because lecture and
exam periods share opening hours but have different expected occupancy
patterns that one boolean couldn't distinguish — and because the old
`is_semester` flag was permanently `true` on all historical pilot data (its
data source, `semester_breaks`, was seeded empty and never populated, so it
carried zero real information).

**Consequence, confirmed live on this dev stack:** every model trained
before this change becomes unloadable, because its saved weights are shaped
for 18 inputs, not 20. `services/ml/src/model/loadModel.js` guards against
this explicitly: before returning a model, it compares the stored
`model_versions.feature_count` to the live feature count (20) and refuses
to load on any mismatch, falling through to the seasonal-baseline forecast
source instead of crashing. This is not a hypothetical — it is happening
right now on this dev stack: `model_versions` id 5 is marked `is_active=true`
(a pre-overhaul model trained under the old 18-feature scheme, its
`feature_count` never backfilled and sitting `NULL`), and the live
container log shows `[ml][...] Active model v5 has feature_count=null,
live encoder produces 20 -- refusing to load` — confirmed by both the log
line and a direct query of `model_versions` this pass.

The full new 18→20 feature list, in order (from `featureEncoder.js`):

| # | Feature | Meaning |
|---|---|---|
| 1–2 | sin/cos(hour) | Time of day, cyclically encoded |
| 3–4 | sin/cos(minute) | Half-hour position within the hour |
| 5–6 | sin/cos(day of week) | Weekday, cyclically encoded |
| 7–8 | sin/cos(week of year) | Seasonal position within the year |
| 9 | is_holiday | 1 if a public holiday |
| 10 | is_lecture | 1 if inside a lecture period (**new**, replaces `is_semester`) |
| 11 | is_exam | 1 if inside an exam period (**new**) |
| 12 | is_break | 1 if inside a lecture-free period (**new**) |
| 13 | temperature | Normalized weather temperature |
| 14 | precipitation | Normalized weather precipitation |
| 15 | weather code | Normalized categorical weather code |
| 16 | lag-1 (30 min ago) | Occupancy one interval back |
| 17 | lag-2 (1 h ago) | Occupancy two intervals back |
| 18 | lag-48 (1 day ago) | Occupancy 48 intervals back |
| 19 | lag-336 (1 week ago) | Occupancy 336 intervals back |
| 20 | is_open | Calendar-derived open/closed flag |

*Replacement:*

**Ersetzungstext (Deutsch):**

> Das Prognosemodell ist unverändert ein gestapeltes LSTM (TensorFlow.js) mit
> 8 Zeitschritten Eingabehistorie, LSTM-Schicht (64 Einheiten) → LSTM-Schicht
> (32 Einheiten) → Dense-Schicht (32 Einheiten, ReLU) → Ausgabeschicht (16
> Einheiten, linear), Adam-Optimierer (Lernrate 0,001), Huber-Verlustfunktion,
> protokolliertes Fehlermaß MAE.
>
> **Geändert hat sich die Anzahl der Eingangsmerkmale: von 18 auf 20.** Das
> bisherige einzelne Semester-Merkmal (ein Wahrheitswert) wurde durch drei
> getrennte Merkmale ersetzt (Vorlesungszeit / Prüfungszeit / vorlesungsfreie
> Zeit), da diese unterschiedliche erwartete Auslastungsmuster haben, obwohl
> sie dieselben Öffnungszeiten teilen. Zudem trug das alte Merkmal in der
> vorliegenden Pilotphase keinerlei Information, da es durchgehend auf „wahr"
> stand.
>
> **Wichtige Folge:** Jedes vor dieser Änderung trainierte Modell kann nicht
> mehr geladen werden, da seine gespeicherten Gewichte für 18 statt 20
> Eingabewerte ausgelegt sind. Das System erkennt dies automatisch anhand
> der in der Modellversion gespeicherten Merkmalsanzahl und weicht in diesem
> Fall automatisch auf die Baseline-Prognose (typische Auslastung) aus, statt
> mit einem Fehler abzubrechen — ein bestehendes, vor der Umstellung
> trainiertes Modell muss also nicht manuell entfernt werden, es wird beim
> nächsten Prognoselauf einfach automatisch übersprungen.

### 4.3.2.18 Training und Bewertung — **NEEDS UPDATE**

*Current text:* Monthly 1st @02:00, rolling 12 months, 50 epochs, batch 32,
`validationSplit` 0.1, min 24 contiguous intervals; explicit caveat that
validation/training windows overlap heavily, making reported error figures
"tendenziell zu optimistisch."

*Evidence:* Re-read `trainModel.js`, `holdoutSplit.js`, `earlyStopping.js`,
`validWindows.js`, `baselines.js` this pass. Confirmed:

- **Schedule**: still monthly, 1st @ 02:00 Europe/Berlin
  (`monthlyRetrain.js`, unchanged), still calls `/retrain` with a rolling
  365-day upper bound — but `trainModel.js` itself now gates on valid
  contiguous windows found within that range, not on elapsed calendar time,
  so the 365-day figure is only an upper bound on the query, not a claim
  about how much data actually gets used.
- **Hold-out — the caveat is resolved**: `holdoutSplit.js` now splits on
  whole local calendar days, holding out the final ~20% of distinct days,
  with a 336-step (7-day) gap enforced between training and hold-out so no
  hold-out row's week-old lag feature can reach back into training data.
  Throws `InsufficientHoldoutError` if fewer than 7 distinct days would
  result, rather than silently evaluating on too small a sample.
- **Early stopping** replaces the fixed 50 epochs: monitors `val_mae`,
  patience 10 epochs, minimum improvement 0.05, capped at 200 epochs.
  Because TensorFlow.js's built-in early stopping has no
  "restore best weights" option, a custom implementation snapshots the
  model's weights on every improvement and restores the best snapshot after
  training ends, rather than keeping whatever weights existed when patience
  ran out.
- **Minimum-data guard counts valid contiguous windows, not raw rows**:
  `ml.min_training_windows` (config key, currently `2000` live) is compared
  against the count from `findValidWindows()` — a window only counts if
  every row in it is finalized, `data_status='observed'`, has complete
  weather, shares one `sensor_config_id`, and sits exactly 30 minutes after
  the previous row. This directly replaces a confirmed bug in the previous
  windowing code, which sliced the query result positionally
  (`rows.slice(i, i+24)`) with no check of actual time gaps between rows —
  a single day-boundary gap in 102 pilot rows produced the previously
  reported "79 windows," none of which were actually gap-free; the new code
  produces **zero** valid windows for that same data, confirmed by a unit
  test asserting exactly this (`ml/test/validWindows.test.js`, case
  "mirrors the confirmed pilot-data bug").
- **Baselines**, all computed on the identical hold-out as the model
  (`baselines.js`): persistence (previous interval's value), same-slot-
  last-week, and constant-training-median. Stored on the `model_versions`
  row (`holdout_mae`, `baseline_mae`) — not just logged to the container
  console as before.
- **Promotion rule**: a trained model is only activated
  (`status='active'`) if its hold-out MAE beats the seasonal-baseline MAE
  computed on that same hold-out; otherwise it is stored as
  `status='rejected'` and serving continues from whatever was active
  before (or the baseline). Every attempt — including one skipped for
  insufficient data (`status='skipped'`, with a `skip_reason` text) — writes
  a `model_versions` row, so the full history of attempts (not just
  successes) is visible in the dashboard's model table.

Live confirmation this pass (`GET /status` on the `ml` service, dev stack):
the five pre-overhaul model rows (ids 1–5, all trained 2026-07-06) all show
`epochs: 50` and a `train_from`/`train_to` span of exactly one calendar
year — consistent with the old fixed-epoch, fixed-window behavior this
overhaul replaces. All five also show `valid_windows`, `holdout_mae`,
`baseline_mae`, `feature_count` = `null`, since these columns did not exist
when they were written.

*Replacement:*

**Ersetzungstext (Deutsch):**

> Das Training erfolgt weiterhin automatisch am 1. jedes Monats um 02:00 Uhr,
> mit einem rollierenden Betrachtungszeitraum von bis zu 12 Monaten. Mehrere
> methodische Schwächen wurden behoben:
>
> **Die bisherige methodische Einschränkung ist aufgelöst.** Es existiert nun
> eine echte, zeitlich getrennte Testmenge: Das letzte rund ein Fünftel der
> vorhandenen Kalendertage wird vollständig als Testzeitraum zurückgehalten,
> mit einer zusätzlichen einwöchigen Lücke zum Trainingszeitraum, damit keine
> Woche alte Vergleichswerte aus der Testmenge ins Training zurückwirken
> können. Die berichteten Fehlerkennzahlen sind damit nicht mehr strukturell
> zu optimistisch.
>
> Die Anzahl der Trainingsepochen ist nicht mehr fest auf 50 vorgegeben,
> sondern wird durch „Early Stopping" bestimmt: Das Training endet
> automatisch, sobald sich der Fehler auf der Testmenge zehn Epochen lang
> nicht mehr nennenswert verbessert, wobei stets der beste beobachtete Stand
> übernommen wird — maximal 200 Epochen.
>
> Die Mindestdatenmenge für ein Training wird nicht mehr in einfachen
> Datenzeilen gezählt, sondern in tatsächlich nutzbaren, lückenlosen
> Trainingsfenstern (derzeit mindestens 2.000, über einen
> Konfigurationsschlüssel einstellbar) — ein einzelner fehlender Zeitpunkt
> in den Rohdaten kann sonst fälschlich als viele nutzbare Fenster gezählt
> werden, was in der Pilotphase nachweislich der Fall war.
>
> Jedes trainierte Modell wird zusätzlich gegen eine einfache
> Vergleichsprognose (durchschnittliche Belegung nach Wochentag und Uhrzeit)
> auf genau derselben Testmenge geprüft und **nur dann aktiv geschaltet, wenn
> es diese Vergleichsprognose tatsächlich schlägt** — zuvor wurde jedes neu
> trainierte Modell ungeprüft aktiv gesetzt. Jeder Trainingsversuch wird mit
> Ergebnis (aktiviert / abgelehnt / übersprungen mangels Daten) in der
> Modellversionstabelle festgehalten und ist auf der ML-Seite des Dashboards
> einsehbar.

### 4.3.2.19 Prognoseerzeugung und Echtzeitverhalten — **NEEDS UPDATE**

*Current text:* Hourly at :10, autoregressive over 336 steps (7 days), days
5–7 described as less certain than the short-term forecast.

*Evidence:* Re-read `predict.js` this pass. Generation is still hourly at
:10. The autoregressive loop is now **capped at 24 steps (12 hours)**, down
from 336 (7 days) — not a smaller claimed uncertainty, an outright cap. The
reason, confirmed directly in code and its accompanying comment: every
complete 336-step run on record (five runs, across four different model
versions) produced **byte-identical** output for days 2 through 7 — not
merely "less certain," but a confirmed mathematical fixed point the
autoregressive loop converges to and never leaves, carrying zero additional
predictive information beyond roughly the first day. Publishing that
output as a multi-day forecast would show false precision. Beyond the
12-hour cap, the widget's 7-day view is now served entirely by the seasonal
baseline (`generateBaselineForecast()`, always computed alongside
regardless of whether an LSTM is active), labeled "typical for this time,"
never presented as a model prediction — confirmed in `widget/page.tsx`,
which shows "typische Auslastung" for exactly this case.

A second, independent fix in the same file: forecasts are now refused
(not published, no database write) if the seed history's most recent row
is more than 2 hours old — before this fix, the autoregressive loop
anchored on whichever row happened to be last in the database rather than
on "now," so once ingestion stalled, it kept silently re-predicting the
same dead period going forward with nothing noticing (one observed run
kept serving a week-old forecast for 13 days).

*Replacement:*

**Ersetzungstext (Deutsch):**

> Die Prognose wird weiterhin stündlich zur Minute :10 durch den Scheduler
> neu erzeugt. Der Vorhersagehorizont des eigentlichen Modells wurde jedoch
> von 7 Tagen auf 12 Stunden begrenzt. Grund: Bei einer mehrtägigen
> autoregressiven Vorhersage — das Modell verwendet seine eigenen
> Vorhersagen als Eingabe für den jeweils nächsten Schritt — läuft die
> Berechnung nachweislich in einen festen Endzustand: In allen bisher
> vollständig durchgeführten 7-Tage-Läufen waren die Werte für Tag 2 bis 7
> exakt identisch, unabhängig vom Ausgangszeitpunkt. Eine Anzeige dieser
> Werte als Tagesprognose würde eine Genauigkeit vortäuschen, die tatsächlich
> nicht vorhanden ist. Für den Zeitraum über 12 Stunden hinaus zeigt das
> Widget stattdessen durchgehend die durchschnittliche, „typische" Auslastung
> für Wochentag und Uhrzeit, erkennbar als solche gekennzeichnet und nicht
> als Modellvorhersage dargestellt.
>
> Zusätzlich verweigert das System die Veröffentlichung einer Prognose, wenn
> die zugrundeliegenden aktuellen Daten älter als zwei Stunden sind — zuvor
> konnte eine unterbrochene Datenerfassung dazu führen, dass tagelang
> unbemerkt eine veraltete Prognose weiter angezeigt wurde.

### 4.3.2.20 Verhalten bei fehlenden Daten — **NEEDS UPDATE**

*Current text:* Missing inputs → 0 at normalization; no trained model → 503;
fewer than 8 intervals → 400; sensor failure → last known occupancy
persists, forecast relies on historical patterns.

*Evidence:* Re-read `predict.js`, `featureEncoder.js`, `occupancy.js` this
pass, point by point:

- **Missing individual feature values → 0 at normalization**: still true,
  unchanged (`featureEncoder.js`'s `normalise()` returns 0 for
  `null`/`undefined`/`NaN`).
- **Fewer than 8 history intervals → HTTP 400**: still true, unchanged,
  confirmed at the exact code line (`if (history.length < LOOKBACK)`,
  `LOOKBACK=8`).
- **No trained model → HTTP 503**: **no longer true.** `predict.js` now
  returns HTTP 200 with `active_source: 'baseline'` or `'collecting_data'`
  in this case — a fallback forecast source is itself a normal, expected
  outcome now, not an error condition. Confirmed live on this dev stack:
  the currently-active model (id 5) is unloadable (feature-count mismatch,
  see 4.3.2.17), and `curl /api/v1/public/widget` returns HTTP 200 with
  `active_source: "collecting_data"` — not a 503.
- **Sensor failure → "last known occupancy persists"**: this is **still
  true for the live, right-now occupancy figure** shown on the dashboard
  and widget gauge — `getCurrentOccupancy()` (`occupancy.js`, confirmed
  unchanged, not touched by this overhaul) simply sums real sensor events
  since local midnight, so if no new events arrive, the sum naturally stops
  changing and holds its last value. **It is no longer true, however, for
  the historical data the forecast is trained and evaluated on**: a genuine
  sensor outage lasting more than two hours during opening hours is now
  explicitly recorded as `data_status='no_data'` with occupancy stored as
  `NULL` — never silently carried forward as a fabricated value into the
  training data. This is the concrete mechanism that distinguishes "library
  genuinely empty" (a recorded, correct zero) from "sensor not reporting"
  (an explicit, honest "unknown") — a distinction the previous system could
  not make at all.

*Replacement:*

**Ersetzungstext (Deutsch):**

> Fehlende einzelne Eingabewerte werden bei der Normalisierung weiterhin
> durch 0 ersetzt; für eine Prognose werden weiterhin mindestens 8
> zurückliegende Intervalle benötigt (sonst Status 400).
>
> **Geändert hat sich das Verhalten ohne trainiertes Modell:** Statt eines
> Fehlerstatus (503) liefert der Dienst nun grundsätzlich eine Antwort mit
> Status 200, die angibt, aus welcher Quelle die Prognose stammt
> (Modellprognose, typische Auslastung, oder „es werden noch Daten
> gesammelt"). Ein fehlendes oder nicht ladbares Modell ist damit kein
> Fehlerfall mehr, sondern ein regulärer, im Betrieb vorgesehener Zustand.
>
> Bei einem Sensorausfall gilt weiterhin: Der aktuell angezeigte
> Belegungswert (auf Dashboard und Widget) hält automatisch seinen letzten
> bekannten Stand, solange keine neuen Zählereignisse eintreffen. **Neu**
> ist die Behandlung in den historischen, für Training und Auswertung
> genutzten Daten: Ein Sensorausfall von mehr als zwei Stunden während der
> Öffnungszeit wird dort nicht mehr stillschweigend übernommen, sondern
> ausdrücklich als „unbekannt" (keine Zahl, kein geschätzter Wert)
> vermerkt. Damit lässt sich im Nachhinein eindeutig unterscheiden, ob die
> Bibliothek tatsächlich leer war oder ob der Sensor schlicht nicht
> gemeldet hat — zuvor war diese Unterscheidung technisch nicht möglich.

### 4.3.2.21 Empfehlungen für den Weiterbetrieb — **NEEDS UPDATE**

*Current text:* Four measures — (1) fix the aggregation problem so weather/
holiday/semester data reaches training, then retrain; (2) introduce a
time-separated hold-out; (3) persist the training-window count per model
version in `model_versions`; (4) add a visible uncertainty indicator to the
widget.

*Evidence, each re-checked against current code this pass:*

1. **Aggregation fixed** — `[DONE]`. `aggregateIntervals.js` rewritten;
   weather/holiday/period-type now reach every finalized row (Part 2 below
   has the full root-cause account). **Retrain still outstanding** — see
   Part 8; a real retrain needs real post-remount sensor data, which
   doesn't exist yet.
2. **Time-separated hold-out** — `[DONE]`. `holdoutSplit.js`, confirmed
   above under 4.3.2.18.
3. **Training-window count persisted per model version** — `[DONE]`.
   `model_versions.valid_windows`, confirmed live in the schema query and
   in `GET /status`'s response shape (currently `null` on the five
   pre-overhaul rows, populated on any row trained after this migration).
4. **Visible uncertainty indicator on the widget** — `[NOT DONE]`. Re-read
   `widget/page.tsx` in full this pass: no variance, confidence band, or
   staged hint of any kind exists anywhere in the component. The document's
   own recommendation stands unaddressed.

*Replacement:*

**Ersetzungstext (Deutsch):**

> Von den vier ursprünglich empfohlenen Maßnahmen sind drei technisch
> umgesetzt: Die Aggregationsproblematik ist behoben (siehe neuer Abschnitt
> zur Aggregation), ein echter zeitlich getrennter Testzeitraum ist
> eingeführt, und die Anzahl der tatsächlich nutzbaren Trainingsfenster wird
> je Modellversion dauerhaft in der Datenbank gespeichert statt nur im
> Container-Log.
>
> **Ein erneutes Training auf Basis der reparierten Aggregation steht noch
> aus** — sinnvoll ist dies erst mit echten Daten nach der endgültigen
> Sensormontage, nicht mit den verworfenen Pilotdaten aus der Zeit davor.
>
> **Weiterhin offen:** Eine sichtbare Kennzeichnung der Unsicherheit im
> Widget für längere Prognosehorizonte wurde noch nicht umgesetzt. Da der
> Prognosehorizont inzwischen ohnehin auf 12 Stunden begrenzt und der
> verbleibende Zeitraum ausdrücklich als „typische Auslastung" statt als
> Modellprognose gekennzeichnet ist, hat sich die Dringlichkeit dieser
> Empfehlung verringert, sie bleibt aber offen. Aktualisierte
> Gesamtempfehlung siehe letzter Abschnitt dieses Berichts.

---

## Part 2 — Broken cross-references: the aggregation problem

**Confirmed exactly as described.** `Übergabedokument_bib.docx` cites
"Abschnitt 4.3.2.6" as the location of the aggregation problem in two
places: once in "Empfehlungen für den Weiterbetrieb" ("Behebung der
Aggregationsproblematik (Abschnitt 4.3.2.6)") and once in the Architecture
table's "Verwendete Kontextdaten" row ("...derzeit eingeschränkt durch die
Aggregationsproblematik (Abschnitt 4.3.2.6)"). 4.3.2.6 is genuinely the
`.env`/environment-variables section (confirmed by reading the extracted
document in full) — it has never documented the aggregation problem, and no
other subsection does either.

### Original symptom

Every `occupancy_intervals` row stayed `is_open = TRUE` permanently and its
weather columns (`weather_temp`, `weather_precip`, `weather_code`) stayed
`NULL` permanently, regardless of actual time of day, weekday, or holiday —
even though `weather_cache` itself held populated rows. The Architecture
table's own "Verwendete Kontextdaten" note already hinted at this ("derzeit
eingeschränkt") without saying what "this" was.

### Root cause (confirmed by direct source reading, not inferred)

`services/scheduler/src/jobs/aggregateIntervals.js`, in its pre-overhaul
form, called `JSON.parse()` on the `semester_breaks` configuration value.
`pg` (the Postgres driver) already auto-deserializes `JSONB` columns into
real JavaScript values — so a seeded empty array (`[]`) arrived as an actual
JS array, not a string. `JSON.parse()` first stringifies whatever it's
given (`String([]) === ''`), then tries to parse that string as JSON — and
`JSON.parse('')` throws `SyntaxError: Unexpected end of JSON input`. This
happened on **every single invocation**, before the per-interval update loop
ever ran, silently caught by an outer `try`/`catch` that only logged the
error to the console. The job's cron registration and container health were
both fine throughout — this was pure application-logic exception swallowing,
invisible to `docker compose ps` or a restart. A second, independent
contributing cause: even had the crash not existed, `weather_cache` at the
time held only forward-looking forecast rows with zero date overlap against
the historical occupancy data being aggregated — the backfill would have
found nothing to attach regardless.

### What was changed

`aggregateIntervals.js` was rewritten in full (not patched). It no longer
reads `semester_breaks` from `config` at all — opening hours are now derived
from two new dedicated tables (`calendar_periods`, `calendar_lecture_free`)
via a pure resolver function, and weather is drawn from a separate
"historical" source in `weather_cache` (distinguished from forward
forecasts by a new `source` column), populated by a new daily backfill job.
The rewritten job also now writes a row for **every** 30-minute slot in a
finalized range, not only slots that received a real sensor event — see
Part 4's calendar/weather subsections and 4.3.2.16 in Part 1 for the full
detail.

### How an operator verifies it works

```sql
SELECT
  count(*)                                                          AS total_finalized,
  count(*) FILTER (WHERE period_type IS NULL)                       AS missing_period_type,
  count(*) FILTER (WHERE is_open IS NULL)                            AS missing_is_open,
  count(*) FILTER (WHERE data_status='observed' AND is_open=true
                         AND weather_temp IS NULL)                   AS open_observed_missing_weather
FROM occupancy_intervals WHERE is_finalized = TRUE;
```

**Actual output, run against the local dev stack this pass:**

```
 total_finalized | missing_period_type | missing_is_open | open_observed_missing_weather
------------------+----------------------+------------------+--------------------------------
               52 |                    0 |                0 |                             37
```

`missing_period_type` and `missing_is_open` at zero confirm the core fix:
every finalized row now has a real calendar-derived value, none stuck at a
default. **`open_observed_missing_weather` is not zero, and this report
will not paper over that.** Tracing it further:

```sql
SELECT source, min(forecast_for), max(forecast_for), count(*) FROM weather_cache GROUP BY source;
```

```
  source  |    min     |    max     | count
----------+------------+------------+-------
 forecast | 2026-07-12 | 2026-07-30 |    19
```

**Zero `historical`-source rows exist in this dev database at all.** The
37 rows missing weather are the pilot-era dates (2026-07-02 through
2026-07-06) — the daily `fetchWeatherHistorical.js` job only ever fetches
"yesterday and today," so it never automatically reaches back to backfill
an older gap; that requires a manual, one-time
`backfillWeather.js --from 2026-07-02 --to 2026-07-06` run, which has not
been done on this dev stack. This is not a bug in the fix — it is the
documented, correct behavior of a system that refuses to substitute a
forecast value for a genuine historical gap (see 4.3.2.16/Weather in Part
4) — but it does mean the aggregation fix alone is not sufficient to get
weather onto historical rows; the backfill script has to be run once,
explicitly, for whatever historical range needs it. Recorded as an Open
Point (Part 8).

**Insertion point:** immediately after the current "Konfiguration über
Umgebungsvariablen (.env)" content, as a new **4.3.2.6a "Aggregationsproblematik
(behoben)"** (or renumber subsequent sections by one — either is
acceptable, but the two existing cross-references below must be repointed
to whichever number is chosen, not left pointing at the `.env` section).

**Cross-references to repoint:**
1. "Empfehlungen für den Weiterbetrieb" (Part 1, 4.3.2.21) — "Behebung der
   Aggregationsproblematik (Abschnitt 4.3.2.6)" → the new section number,
   and its framing changes from a recommendation to a statement of what was
   done (see the 4.3.2.21 replacement text in Part 1, which already
   reflects this).
2. The Architecture table's "Verwendete Kontextdaten" row (4.3.2.17) →
   same repoint; the 4.3.2.17 replacement text in Part 1 already removes
   the "derzeit eingeschränkt" framing entirely since the limitation no
   longer exists in the code (though see the weather-backfill gap noted
   above).

---

## Part 3 — Forecast sources and switching between them (new material)

This entire section is new — the current document assumes a single
forecast source and never mentions a fallback. Written in German, for
non-developer readers, per the task's requirement. Every mechanism below
was traced to its actual file and function, not assumed.

**Ersetzungstext (Deutsch), vollständiger neuer Abschnitt:**

> ### Prognosequellen und automatischer Wechsel zwischen ihnen
>
> Die angezeigte Prognosezahl kann an verschiedenen Tagen aus
> unterschiedlichen Quellen stammen. Das ist kein Fehler, sondern eine
> bewusste, automatische Anpassung an die tatsächlich vorhandene
> Datenmenge. Dieser Abschnitt erklärt, woher die Zahl jeweils kommt und
> wann sich das ändert.
>
> #### Wie die Baseline-Prognose funktioniert
>
> Die Baseline (typische Auslastung) ist eine einfache
> Durchschnittsprognose: Für jede Kombination aus Wochentag und
> Halbstunden-Zeitpunkt (zum Beispiel Dienstag, 14:00 Uhr) wird der
> Durchschnitt aller bisher tatsächlich gemessenen Belegungswerte zu genau
> diesem Zeitpunkt gebildet. Trifft eine neue Prognose an, wird für jeden
> zukünftigen Zeitpunkt einfach der passende Durchschnittswert
> nachgeschlagen.
>
> Berücksichtigt werden dabei ausschließlich abgeschlossene, als
> beobachtet markierte Intervalle einer einzigen Sensor-Konfiguration
> (siehe Abschnitt Sensorkonfiguration) — Intervalle mit unbekanntem
> Sensorzustand (keine Daten) fließen nicht ein. Geschlossene Zeiten sind
> nicht ausgeschlossen, sondern fließen als korrekte Nullwerte in den
> jeweiligen Durchschnitt ein, wodurch sich die Werte für geschlossene
> Zeiträume von selbst nahe null einpendeln. Es wird die gesamte bisher
> vorhandene Historie herangezogen, kein rollierendes Zeitfenster.
>
> Was passiert bei einer Zeitzelle ohne bisherige Beobachtung (zum
> Beispiel ein Dienstag 08:30 Uhr, der noch nie vorkam)? Es wird nicht
> interpoliert und keine benachbarte Zelle herangezogen. Stattdessen greift
> ein dreistufiger Rückfall: zuerst der genaue Zeitpunkt, ersatzweise der
> Durchschnitt über den gesamten Wochentag, ersatzweise der Durchschnitt
> über die gesamte bisherige Historie. Die Prognose wird nie komplett
> unterdrückt, solange überhaupt irgendeine Historie existiert.
>
> Voraussetzung für die Baseline-Prognose ist ein Mindestbestand von
> aktuell 14 Tagen an nutzbaren, beobachteten Daten (einstellbar über
> einen Konfigurationsschlüssel). Unterhalb dieser Schwelle liefert die
> Baseline gar keine Prognose — es gibt keine schwächere Zwischenstufe.
> Die Baseline wird bei jeder Prognoseerzeugung (stündlich, siehe unten)
> komplett neu aus der aktuellen Historie berechnet, nicht zwischengespeichert.
> Sie deckt denselben 7-Tage-Horizont ab wie die Wochenansicht des
> Widgets, liefert aber — anders als das Modell — grundsätzlich keinen
> Unsicherheitshinweis, nur einen einzelnen Schätzwert je Zeitpunkt.
> Geschrieben wird sie in dieselbe Datenbanktabelle wie die
> Modellprognose, jedoch mit einer eigenen Quellenkennzeichnung, sodass
> beide nebeneinander bestehen können.
>
> #### Wie der Wechsel zwischen den Quellen funktioniert
>
> Die eigentliche Entscheidung, ob eine Modellprognose oder die
> Baseline-Prognose verwendet wird, fällt nicht bei jeder einzelnen
> Dashboard- oder Widget-Abfrage, sondern einmal pro stündlichem
> Prognoselauf, wenn der Scheduler den ML-Dienst zur Vorhersage aufruft.
> Das bedeutet: Ein Quellenwechsel wird spätestens innerhalb einer Stunde
> wirksam, nicht sofort.
>
> Die Entscheidung selbst prüft mehrere Dinge der Reihe nach:
>
> 1. Sind die zugrundeliegenden aktuellen Daten jünger als zwei Stunden?
>    Wenn nicht: keine Prognose, Zustand „es werden noch Daten gesammelt".
> 2. Lässt sich ein aktives, trainiertes Modell laden? Ein Modell gilt
>    als ladbar, wenn es als aktiv markiert ist und seine gespeicherte
>    Merkmalsanzahl mit der aktuell verwendeten übereinstimmt. Ist die
>    Datei nicht vorhanden oder das Laden schlägt aus einem anderen Grund
>    fehl, wechselt das System automatisch und ohne Fehlermeldung auf die
>    Baseline-Prognose — dies wurde nicht nur im Code so vorgesehen,
>    sondern in der Entwicklungsumgebung tatsächlich live beobachtet: Ein
>    dort hinterlegtes, vor der Merkmalsänderung trainiertes Modell wird
>    bei jedem Versuch mit der Meldung „refusing to load" abgelehnt und
>    die Auslieferung läuft unterbrechungsfrei mit der Baseline weiter.
> 3. Ist kein Modell ladbar: Liefert die Baseline-Berechnung einen Wert
>    (siehe Mindestbestand oben)? Wenn ja, wird die Baseline verwendet,
>    wenn nein, bleibt es beim Zustand „es werden noch Daten gesammelt".
>
> Ob ein Modell überhaupt jemals aktiv werden durfte, wird bereits beim
> Training entschieden, nicht bei jeder Auslieferung neu geprüft: Nur ein
> Modell, dessen Testfehler die Baseline auf der gleichen Testmenge
> tatsächlich unterboten hat, wird als aktiv markiert. Diese
> Vergleichsentscheidung wird also einmalig beim Training getroffen, nicht
> laufend neu bewertet.
>
> Die tatsächlich aktive Quelle ist in jeder Antwort der öffentlichen
> Widget-Schnittstelle und der internen Dashboard-Schnittstelle als
> eigenes Feld enthalten, mit den möglichen Werten Modellprognose,
> Baseline oder Datensammlung läuft. Das Widget zeigt dies dem Endnutzer
> als Beschriftung neben der Prognose an (Modellprognose beziehungsweise
> typische Auslastung), beziehungsweise zeigt im dritten Fall gar keine
> Zahlen, sondern nur einen Hinweistext.
>
> Eine manuelle, gezielte Erzwingung einer bestimmten Quelle durch
> Betriebspersonal existiert nicht. Es gibt weder einen
> Konfigurationsschalter noch eine Umgebungsvariable noch eine
> Dashboard-Schaltfläche dafür. Das allgemeine Konfigurationsformular des
> Dashboards würde zwar technisch jeden beliebigen Schlüssel entgegennehmen,
> ein solcher Schlüssel würde aber von keiner Stelle im System gelesen und
> hätte daher keine Wirkung.
>
> Ein Quellenwechsel wird nicht gesondert protokolliert oder in einer für
> Betriebspersonal sichtbaren Liste festgehalten — erkennbar ist er nur
> daran, welche Quelle das Widget beziehungsweise das Dashboard gerade
> anzeigt, und daran, welche Modellversion in der Modellversionstabelle
> zuletzt als aktiv beziehungsweise abgelehnt markiert wurde.
>
> Beispiel — der Morgen nach einem Neutraining, bei dem das Modell die
> Baseline nicht schlagen konnte: Um 02:00 Uhr läuft das monatliche
> Training. Das neue Modell erzielt einen Testfehler, der schlechter ist
> als der Baseline-Vergleichswert auf derselben Testmenge. Die
> Modellversion wird mit dem Status abgelehnt gespeichert, jedoch nicht
> gelöscht — ihre Kennzahlen bleiben auf der ML-Seite des Dashboards
> einsehbar. Kein neues Modell wird aktiv geschaltet; ein zuvor aktives
> Modell bleibt es. Beim nächsten stündlichen Prognoselauf (spätestens
> 03:10 Uhr) prüft der ML-Dienst erneut, ob ein ladbares aktives Modell
> existiert — falls das vorherige Modell weiterhin gültig ist, liefert es
> weiterhin die Modellprognose; falls kein gültiges Modell existiert,
> liefert stattdessen die Baseline die Zahlen. In beiden Fällen bemerkt
> ein Endnutzer nichts außer der Quellenbeschriftung im Widget.
>
> #### Hinweis für den Bereitschaftsbetrieb
>
> Zeigt das Widget typische Auslastung statt einer Modellprognose an, ist
> das zunächst kein Fehlerzustand und erfordert keine sofortige Reaktion —
> es bedeutet lediglich, dass entweder noch kein Modell die Baseline im
> letzten Training übertreffen konnte, oder dass das zuletzt aktive Modell
> aus einem technischen Grund (zum Beispiel nach einer Merkmalsänderung)
> nicht mehr geladen werden kann. Prüfenswert wird die Situation erst,
> wenn dieser Zustand über mehrere Trainingszyklen hinweg bestehen bleibt,
> obwohl erkennbar ausreichend neue, durchgehende Belegungsdaten vorliegen
> — das deutete dann auf ein grundsätzliches Problem mit der
> Modellqualität oder der Datenlage hin, das über die ML-Seite des
> Dashboards (Modellversionstabelle, Spalten Testfehler und
> Baseline-Fehler) weiter eingegrenzt werden sollte.

**Evidence/file references for the above (English, for whoever verifies
this later):**
- Baseline computation, fallback tiers, min-days gate, recompute-per-call:
  `services/ml/src/services/seasonalBaseline.js` (`computeSeasonalProfile()`,
  `buildSeasonalProfileFromRows()`, `generateBaselineForecast()`).
- Decision file/function, evaluated once per hourly forecast run (not per
  request): `services/ml/src/routes/predict.js`, `router.post('/', ...)`.
- Model-loadability check (feature-count guard) and automatic fallback on
  load failure: `services/ml/src/model/loadModel.js`, `getActiveModel()`.
  Live-observed failure this pass: `model_versions` id 5,
  `feature_count IS NULL`, live container log
  `[ml][...] Active model v5 has feature_count=null, live encoder produces
  20 -- refusing to load`.
- Promotion (MAE-comparison) decided once, at training time, not at serve
  time: `services/ml/src/model/trainModel.js` (promotion gate), confirmed
  distinct from the serve-time check in `loadModel.js`.
- `active_source` field surfaced in both public and dashboard responses:
  `services/api/src/services/forecastState.js` (`getActiveForecastState()`),
  consumed by `services/api/src/routes/public.js` and `routes/dashboard.js`.
- No manual override exists: `services/api/src/middleware/validate.js`'s
  `validateConfigBody()` accepts an arbitrary key/value pair, but no
  downstream code path (`predict.js`, `forecastState.js`) reads any such
  override key — confirmed by reading both files in full.
- Widget display per state: `frontend/src/app/widget/page.tsx`.

---

## Part 4 — Further new subsections

### 4a. Semesterkalender und Öffnungszeiten

**Proposed insertion point:** immediately before "Daten und Prognosemodell"
(4.3.2.16), since the calendar is now the direct source of the `is_open`
column that section explains.

*Evidence:* `services/scheduler/src/lib/calendar.js` (the resolver,
re-read in full this pass), `calendarRepo.js` (DB access), live query of
`calendar_periods`/`calendar_lecture_free` (dev DB, this pass — 7 period
rows, 5 lecture-free ranges, shown below).

**Ersetzungstext (Deutsch):**

> Die Öffnungszeiten der Bibliothek werden nicht mehr über feste
> Konfigurationswerte, sondern über einen Semesterkalender in der Datenbank
> gesteuert. Zwei Tabellen bilden diesen Kalender ab:
>
> - **Zeiträume** (`calendar_periods`): benannte Abschnitte mit Start- und
>   Enddatum, einer Art (Vorlesungszeit, Prüfungszeit, vorlesungsfreie
>   Zeit) und den dafür geltenden Öffnungszeiten.
> - **Vorlesungsfreie Einzeltage** (`calendar_lecture_free`): einzelne Tage
>   oder kurze Zeiträume innerhalb einer Vorlesungszeit, an denen dennoch
>   die Öffnungszeiten der vorlesungsfreien Zeit gelten (zum Beispiel
>   Brückentage), statt dass die Bibliothek geschlossen wäre.
>
> Für jeden Kalendertag wird die Öffnungszeit nach folgender Reihenfolge
> bestimmt, wobei die erste zutreffende Regel entscheidet:
>
> 1. Samstag oder Sonntag → geschlossen.
> 2. Gesetzlicher Feiertag im Land Brandenburg → geschlossen (dies gilt
>    auch dann, wenn der Feiertag zusätzlich auf ein Wochenende fällt —
>    andernfalls würde eine fehlerhafte Feiertagsprüfung nie auffallen,
>    weil Regel 1 den Tag ohnehin schon schließen würde).
> 3. Vorlesungsfreier Einzeltag innerhalb einer Vorlesungszeit → geöffnet
>    mit den Zeiten der vorlesungsfreien Zeit (10:00–17:00 Uhr).
> 4. Ansonsten: die für den jeweiligen Zeitraum hinterlegten Öffnungszeiten
>    (Vorlesungs- und Prüfungszeit 09:00–19:00 Uhr, vorlesungsfreie Zeit
>    10:00–17:00 Uhr).
>
> Findet sich für ein Datum überhaupt kein hinterlegter Zeitraum, verweigert
> das System bewusst eine automatische Annahme und meldet dies als Fehler,
> statt stillschweigend „geöffnet" oder „geschlossen" zu unterstellen —
> genau ein solches stillschweigendes Verhalten hatte zuvor dazu geführt,
> dass die Kennzeichnung „Semesterzeit" dauerhaft und unbemerkt auf „wahr"
> hängen blieb.
>
> **Eine neue Semesterzeit hinzuzufügen ist eine reine Datenänderung, keine
> Codeänderung.** Es genügt, einen neuen Zeitraum in die Tabelle
> `calendar_periods` einzutragen. Vorgehen in der Praxis:
>
> 1. Neue Datei im Ordner `db/init/` anlegen, mit der nächsten freien
>    Nummer, zum Beispiel `014_ss27_kalender.sql`.
> 2. Darin die neuen Zeiträume eintragen, zum Beispiel für das
>    Sommersemester 2027:
>
>    ```sql
>    INSERT INTO calendar_periods
>      (label, period_type, start_date, end_date, opens_local, closes_local, semester_label, specificity)
>    VALUES
>      ('SS27 Vorlesungszeit', 'lecture', '2027-03-23', '2027-07-03', '09:00', '19:00', 'SS27', 3),
>      ('SS27 Prüfungszeit',   'exam',    '2027-07-04', '2027-07-23', '09:00', '19:00', 'SS27', 2),
>      ('SS27 Ferien',         'break',   '2027-07-24', '2027-09-21', '10:00', '17:00', 'SS27', 1)
>    ON CONFLICT DO NOTHING;
>    ```
>
>    Etwaige einzelne vorlesungsfreie Tage (Brückentage, Feiertagsbrücken)
>    kommen entsprechend in `calendar_lecture_free`.
> 3. Die Datei auf dem Server einspielen:
>    `docker compose exec -T db sh < db/migrate.sh` (siehe Abschnitt
>    „Migrationen").
> 4. Prüfen: `SELECT * FROM calendar_periods ORDER BY start_date;` sollte den
>    neuen Zeitraum zeigen.
>
> Keine Anwendung muss dafür neu gebaut oder neu gestartet werden — der
> Kalender wird bei jedem nächtlichen Abschlusslauf frisch aus der
> Datenbank gelesen.
>
> Aktuell hinterlegt (Entwicklungsdatenbank, Stand dieses Berichts):
>
> | Zeitraum | Art | Von | Bis | Öffnungszeit |
> |---|---|---|---|---|
> | Pre-SS26 break | Ferien | 2026-03-01 | 2026-03-22 | 10:00–17:00 |
> | SS26 Vorlesungszeit | Vorlesung | 2026-03-23 | 2026-07-04 | 09:00–19:00 |
> | SS26 Prüfungszeit | Prüfung | 2026-07-05 | 2026-07-24 | 09:00–19:00 |
> | SS26 Ferien | Ferien | 2026-07-25 | 2026-09-22 | 10:00–17:00 |
> | WS26 Vorlesungszeit | Vorlesung | 2026-09-21 | 2027-01-16 | 09:00–19:00 |
> | WS26 Prüfungszeit | Prüfung | 2027-01-17 | 2027-02-06 | 09:00–19:00 |
> | WS26 Ferien | Ferien | 2027-02-07 | 2027-03-22 | 10:00–17:00 |
>
> **Der Kalender reicht nur bis 2027-03-22 — ein neuer Zeitraum muss vor
> diesem Datum ergänzt werden, sonst verweigert das System ab dann jede
> automatische Einordnung.** Siehe Open Points.

### 4b. Wetterdaten

**Proposed insertion point:** immediately after the new Semesterkalender
subsection (4a), before 4.3.2.16.

*Evidence:* `services/scheduler/src/jobs/fetchWeather.js`,
`fetchWeatherHistorical.js`, `services/scheduler/src/lib/weatherMapping.js`,
`services/scheduler/src/scripts/backfillWeather.js` — all re-read in full
this pass.

**Ersetzungstext (Deutsch):**

> Wetterdaten kommen aus zwei getrennten, unabhängig geführten Quellen bei
> Open-Meteo:
>
> - **Vorschau** (stündlich abgerufen): die üblichen Wettervorhersagen, wie
>   sie auch zum Zeitpunkt einer echten Prognoseerstellung zur Verfügung
>   stehen.
> - **Historisch** (täglich abgerufen, mit ein bis zwei Tagen Verzögerung):
>   nachträglich verfügbare, „historische Vorhersage"-Daten für bereits
>   vergangene Zeiträume — bewusst **nicht** die sogenannten
>   Reanalyse-/Archivdaten (ERA5), obwohl diese vermeintlich genauer wären.
>   Begründung: Reanalyse-Daten werden nachträglich anhand tatsächlicher
>   Beobachtungen korrigiert, stehen im späteren Live-Betrieb aber gerade
>   nicht zur Verfügung — das Prognosemodell würde beim Training also mit
>   Werten lernen, die es bei der eigentlichen Anwendung nie zu sehen
>   bekommt. Die „historische Vorhersage"-Quelle stellt sicher, dass
>   Training und späterer Betrieb auf vergleichbaren Daten beruhen.
>
> Da Stundenwerte, aber Halbstunden-Intervalle verarbeitet werden, gilt für
> die Zuordnung eine einfache Regel: Sowohl die volle Stunde als auch die
> halbe Stunde übernehmen den Messwert der jeweils laufenden Stunde,
> unverändert — es wird nicht zwischen zwei Stundenwerten interpoliert.
> Für Niederschlag und Wettercode wäre eine Interpolation ohnehin nicht
> sinnvoll (Niederschlag ist ein Stundenwert, Wettercode eine Kategorie);
> aus Konsistenzgründen wird dieselbe Regel auch für die Temperatur
> angewendet.
>
> Für die jüngsten ein bis zwei Tage liegen naturgemäß noch keine
> historischen Daten vor (die Quelle braucht diese Vorlaufzeit). Betroffene
> Intervalle bleiben in dieser Zeit ohne Wetterwert (nicht mit einem
> geschätzten oder dem Vorschau-Wert aufgefüllt) und werden automatisch am
> nächsten Tag nachgetragen, sobald die historische Quelle nachgezogen hat.
>
> Für eine nachträgliche, gezielte Ergänzung (zum Beispiel nach einer
> Standortkorrektur oder einem längeren Ausfall) steht ein Kommandozeilen-
> werkzeug bereit:
>
> ```bash
> docker compose exec scheduler node src/scripts/backfillWeather.js \
>   --from 2026-08-01 --to 2026-08-31 [--dry-run]
> ```
>
> Der Aufruf ist gefahrlos wiederholbar und meldet, wie viele Intervalle
> ergänzt wurden beziehungsweise für welche Tage die historische Quelle
> noch nicht bereitsteht.

### 4c. Sensorkonfiguration und Sensor-Historie

**Proposed insertion point:** immediately after "Sicherheit und
Datenschutz" or as a subsection of 4.3.2 near "Daten und Prognosemodell" —
recommend directly after 4.3.2.16, since it is the direct continuation of
"which sensor produced this data."

*Evidence:* `db/init/006_sensor_configs.sql`,
`services/scheduler/src/scripts/activateSensorConfig.js`, both re-read in
full this pass; live query of `sensor_configs` (dev DB, this pass): one
row, `pilot-2026-07-pre-remount`, installed 2026-07-02, removed
2026-07-09T07:30, `is_active=false`.

**Ersetzungstext (Deutsch):**

> Jede gespeicherte Belegungszeile wird einer konkreten physischen
> Sensormontage zugeordnet. Grund: Nach der bevorstehenden endgültigen
> Deckenmontage ändert sich die Erfassungsgeometrie grundlegend (siehe
> Abschnitt „Standortwechsel"), und Trainingsdaten aus unterschiedlichen
> Montagen dürfen niemals unbemerkt miteinander vermischt werden — eine
> physisch andere Sensorposition bedeutet andere Zählcharakteristik, nicht
> nur andere Zahlen.
>
> Eine eigene Tabelle (`sensor_configs`) führt Buch über jede Montage
> (Bezeichnung, Zeitraum der Nutzung, Montagehöhe, Neigungswinkel,
> abgedeckter Bereich) mit genau einer jeweils „aktiven" Konfiguration. Neue
> Zähl- und Belegungsdaten werden immer der gerade aktiven Konfiguration
> zugeschrieben; ist keine Konfiguration aktiv, verweigert das System die
> Annahme neuer Zählereignisse bewusst, statt sie zu raten.
>
> Aktuell hinterlegt (Entwicklungsdatenbank): eine einzige, historische
> Konfiguration `pilot-2026-07-pre-remount` (genutzt 02.07.–09.07.2026,
> nicht mehr aktiv).
>
> **Nach der endgültigen Montage ist genau einmal folgender Befehl
> auszuführen**, mit den tatsächlichen Werten der neuen Montage:
>
> ```bash
> docker compose exec scheduler node src/scripts/activateSensorConfig.js \
>   --label "post-remount-2026-08" \
>   --area "learning area main entrance" \
>   --mount-height 2.4 --tilt -15 \
>   --notes "korrigierte Montageposition, Deckenmontage"
> ```
>
> Dieser Befehl trägt automatisch eine neue Konfiguration ein, markiert sie
> als aktiv und deaktiviert die vorherige. **Ohne diesen Schritt nimmt der
> Server nach der Montage keine neuen Zähldaten mehr an** — dies ist
> beabsichtigt: Daten ohne bekannte, dokumentierte Sensorposition sollen
> nicht kommentarlos in die Datengrundlage einfließen.

### 4d. Migrationen (Datenbankschema-Änderungen)

**Proposed insertion point:** immediately before "Aktualisierung des
Servers" (4.3.2.13), since that section now directly depends on this
mechanism.

*Evidence:* `db/migrate.sh` (re-read in full this pass), live
`schema_migrations` query (10 rows, all applied, shown in Part 5), naming
convention confirmed via `ls db/init/`.

**Ersetzungstext (Deutsch):**

> Datenbankschema-Änderungen liegen als nummerierte SQL-Dateien im Ordner
> `db/init/` (`004_*.sql` aufwärts; die Dateien `001`–`003` sind einmalige
> Ersteinrichtung und werden nie erneut ausgeführt). Jede Datei ist so
> geschrieben, dass ein wiederholtes Ausführen nichts kaputt macht
> (vorhandene Tabellen/Spalten werden übersprungen, nicht dupliziert).
>
> **Wichtig:** Diese Dateien werden von PostgreSQL nur beim allerersten
> Start auf einem leeren Datenvolume automatisch eingelesen. Auf einem
> bereits laufenden Server mit vorhandenen Daten geschieht das **nicht**
> automatisch — dafür gibt es ein eigenes Werkzeug:
>
> ```bash
> docker compose exec -T db sh < db/migrate.sh
> ```
>
> Dieser Befehl führt jede noch nicht angewandte Datei einmalig aus und
> vermerkt sie in einer eigenen Tabelle (`schema_migrations`). Ein erneuter
> Aufruf überspringt bereits Angewandtes und meldet dies (getestet: ein
> zweiter Aufruf gegen die Entwicklungsdatenbank in dieser Sitzung ergab für
> alle zehn vorhandenen Dateien „already applied", ohne Fehler). Der Befehl
> ist damit gefahrlos bei jedem Update auszuführen, unabhängig davon, ob
> tatsächlich etwas ansteht — siehe Abschnitt „Aktualisierung des Servers".
>
> Um künftig eine neue Schemaänderung hinzuzufügen: nächste freie
> Nummer im Ordner `db/init/` verwenden, die Datei so schreiben, dass ein
> wiederholtes Ausführen unschädlich ist, und anschließend den obigen Befehl
> auf dem Zielserver ausführen.

---

## Part 5 — Verification: actual results

All output below is real, captured against the local development Docker
Compose stack during this pass — nothing is invented or extrapolated.

### Test suite: invocation and result

```bash
docker compose exec -T scheduler node --test
```
Result: **29/29 passed, 0 failed.** (`# tests 29 / # pass 29 / # fail 0`)

```bash
docker compose exec -T ml node --test
```
Result: **20/20 passed, 0 failed.** (`# tests 20 / # pass 20 / # fail 0`)

The `api` service has no test suite (confirmed: no `test` script, no test
framework dependency in `services/api/package.json`).

### Calendar test cases: expected vs. actual

All 22 cases from `services/scheduler/test/calendar.test.js`, run this
pass. Every case's expected outcome is encoded in its own name; all passed
(`ok`), i.e. actual = expected in every row.

| Date | Expected | Actual |
|---|---|---|
| 2026-04-02 (Gründonnerstag, not a public holiday) | Open 10–17 via rule 3 (lecture-free day) | ok |
| 2026-04-03 (Karfreitag) | Closed via rule 2 (holiday) | ok |
| 2026-04-06 (Ostermontag) | Closed via rule 2 | ok |
| 2026-04-07 (not a holiday) | Open 10–17 via rule 3 | ok |
| 2026-05-01 (Tag der Arbeit) | Closed via rule 2 | ok |
| 2026-05-14 (Christi Himmelfahrt) | Closed via rule 2 | ok |
| 2026-05-15 (Brückentag) | Open 10–17 via rule 3 | ok |
| 2026-05-25 (Pfingstmontag) | Closed via rule 2 | ok |
| 2026-09-21 (SS26 Ferien / WS26 Vorlesungszeit overlap) | Lecture period wins (higher specificity), open 09–19 via rule 4 | ok |
| 2026-10-31 (Reformationstag **and** a Saturday) | Closed via rule 2, specifically **not** rule 1 (regression guard) | ok |
| 2026-12-24 (Heiligabend, not an official holiday) | Open 10–17 via rule 3 | ok |
| 2026-12-31 (Silvester, not an official holiday) | Open 10–17 via rule 3 | ok |
| 2027-01-01 (Neujahr) | Closed via rule 2 | ok |
| 2027-01-02 (Saturday, not a holiday) | Closed via rule 1 | ok |
| 2026-02-28 (outside all configured periods) | Throws `UnconfiguredCalendarRangeError` | ok |
| 2026-07-01 09:00 local (CEST) | → 07:00 UTC | ok |
| 2026-12-01 09:00 local (CET) | → 08:00 UTC | ok |
| — | `utcToLocalParts` round-trips `localToUtc` | ok |
| 2026-10-31 (Reformationstag, DE-BB-specific) | Resolves as a holiday | ok |
| 2026-01-06 (Epiphany — DE-BW/DE-BY/DE-ST only, not DE-BB) | Does **not** resolve as a holiday | ok |
| 2026-01-01 (Neujahr, nationwide) | Resolves as a holiday | ok |
| main fixture (48-row aggregation) | see below | ok |

### Aggregation against fixture rows: real query output

Fixture (`aggregateIntervals.test.js`, "main fixture" case): 3 inserted
`raw_events` on 2026-06-16 (07:04, 07:33, 09:02 UTC), then
`aggregateIntervals()` run for the full local day.

**Row count produced: 48** — one per 30-minute slot in the local day,
confirmed by the test's own `assert.equal(rows.length, 48, ...)` passing.
Carry-forward behavior confirmed correct by the same passing test:
07:00 UTC entries=3/occupancy=3; 07:30 UTC entries=5 exits=1/occupancy=7;
08:00–08:30 UTC (quiet, sensor confirmed up within its 2-hour heartbeat
window) carried forward at 7, not reset to 0; 09:00 UTC exits=4/occupancy=3;
09:30–11:00 UTC still within heartbeat range, carried forward at 3;
11:30 UTC onward (more than 2 hours past the last real event) marked
`no_data`, occupancy `NULL`, never a fabricated zero; 17:00 UTC onward
(closing time) reset to 0.

Idempotency: re-running `aggregateIntervals()` over the identical range
produces the same 48 rows, no duplicates (`ok 2` above).

Holiday fixture (2026-10-31, Reformationstag **and** a Saturday): all 48
slots `is_open=false`, all 48 `is_holiday=true`, despite an inserted event
— confirmed by the passing test.

Outage fixture (a day with zero `raw_events`): of 48 slots, 20 fall within
opening hours (09:00–19:00 local = 20 half-hour slots) and all 20 show
`data_status='no_data'`, `occupancy=NULL`, `entries`/`exits=NULL` — never a
fabricated zero; the 28 closed-hour slots show `data_status='observed'`,
`occupancy=0` (correctly zero, not unknown) — confirmed by the passing
test's own assertions on both counts.

### `is_open` distribution: real query output

Requested check, run against real historical pilot-era data
(2026-07-04, a Saturday) rather than a synthetic fixture, to show the
`is_open` vs. `data_status` distinction on genuine data:

```sql
SELECT (interval_start AT TIME ZONE 'Europe/Berlin')::time AS local_time,
       is_open, is_finalized, data_status, occupancy
FROM occupancy_intervals
WHERE (interval_start AT TIME ZONE 'Europe/Berlin')::date = '2026-07-04'
ORDER BY 1;
```

```
 local_time | is_open | is_finalized | data_status | occupancy
------------+---------+--------------+-------------+-----------
 10:00:00   | f       | t            | no_data     |
 10:30:00   | f       | t            | no_data     |
 11:00:00   | f       | t            | no_data     |
   ...      | f       | t            | no_data     |
 15:30:00   | f       | t            | no_data     |
 23:30:00   | f       | t            | observed    |         0
```

`is_open=f` for the whole day because 2026-07-04 is a Saturday (rule 1,
unconditionally closed under the current calendar) — independent of
`data_status='no_data'`, which reflects a genuine recorded historical
sensor outage from that same window under the old, pre-overhaul
opening-hours assumption. Two independent facts about the same slots,
visibly not conflated.

### Migration idempotency: second-run result

```bash
docker compose exec -T db sh < db/migrate.sh
```

Second and subsequent run against the dev DB (already fully migrated),
this pass:

```
NOTICE:  relation "schema_migrations" already exists, skipping
skip   004_schema_migrations.sql (already applied)
skip   005_occupancy_interval_status_columns.sql (already applied)
... [all 10 files] ...
migrate.sh: nothing to do, all migrations already applied
```

Zero errors, zero changes — confirmed idempotent.

### API response in every forecast state

Only the state the dev database is actually in right now could be executed
live; the other two are marked not executed, with the reason, rather than
invented.

**`collecting_data` — executed, real output:**
```bash
curl -s http://localhost:3001/api/v1/public/widget
```
```json
{"occupancy":3,"max_occupancy":150,"capacity_label":"Lernbereich","percent":2,"widget_title":"Bibliothek Auslastung","active_source":"collecting_data","data_days_available":5,"forecasts_hours":[],"forecasts_week":[]}
```

**`baseline` — not executed.** This dev database currently has 5 distinct
finalized/observed days of history; the seasonal baseline requires 14
(`ml.min_baseline_days`, confirmed live). Forcing this state would require
fabricating 9+ additional days of fixture data outside the scope of a
read-and-document task.

**`lstm` — not executed.** The only `model_versions` row currently marked
`is_active=true` (id 5) has `feature_count=NULL` and is refused by the
feature-count guard (confirmed live in the container log, see Part 1's
4.3.2.17/Part 3). No model trained under the current 20-feature scheme
exists on this dev stack to load instead. Producing a genuine `lstm`
response would require a real training run against ≥2,000 valid windows,
which this dev dataset (54 `occupancy_intervals` rows) does not have.

**`GET /training-readiness` (ml service) — executed, real output:**
```json
{"validWindows":0,"minTrainingWindows":2000,"ready":false}
```

**`GET /status` (ml service) — executed, real output (truncated to the
active row):**
```json
{"is_training":false,"active_version":null,"versions":[{"id":5,"created_at":"2026-07-06T13:49:08.407Z","train_from":"2025-07-06T13:49:04.378Z","train_to":"2026-07-06T13:49:04.378Z","epochs":50,"loss_final":2.619294,"mae_final":3.061419,"is_active":true,"status":"active","valid_windows":null,"holdout_mae":null,"baseline_mae":null,"skip_reason":null,"feature_count":null}, ...]}
```
Confirms live: `epochs:50` and an exact 365-day `train_from`/`train_to`
span on every pre-overhaul row — consistent with the fixed-epoch,
fixed-window behavior this overhaul replaces (see Part 7).

---

## Part 6 — Framing of prior test results (ready to paste)

**Where this goes:** the figures this block addresses do **not** live
inside Section 4.3.2 at all — they were traced (by reading the full
extracted document, not the task prompt's summary alone) to **Section 6
"Ergebnisse des Prototyps"** (top-level, outside 4.3.2), specifically:

> "In der Präsentation wurde eine durchschnittliche Abweichung von
> ungefähr 3,6 Prozent angegeben... Im Test wurden Ausgänge zuverlässiger
> erfasst als Eingänge."

A second, related claim sits in **Section 3 "Aktueller Übergabestatus"**:

> "Das aus einem LSTM-Modell bestehende Prognosemodell ist Bestandteil der
> geplanten Produktlösung und war in der Prototypphase aufgrund der
> geringen Datenmenge jedoch noch nicht ausreichend aussagekräftig."

**Recommended placement:** insert the block below as a clearly marked
callout box or footnote directly under the Section 6 paragraph quoted
above (the more prominent location, since that's where the 3.6% figure
itself sits), with a one-line cross-reference added to the Section 3
passage pointing to it.

**Ersetzungstext (Deutsch), einfügbarer Block:**

> **Hinweis zur Einordnung aller bisherigen Test- und Genauigkeitsangaben**
>
> Alle in diesem Dokument genannten Test- und Genauigkeitsangaben —
> insbesondere die durchschnittliche Abweichung von rund 3,6 Prozent
> zwischen gezählten Ein- und Ausgängen, alle in der Modellversionstabelle
> festgehaltenen Verlust- und Fehlerwerte (Loss, MAE) sowie die Aussage,
> dass Ausgänge zuverlässiger erfasst wurden als Eingänge — **stammen
> ausnahmslos aus der Prototypphase, vor dem im Juli 2026 durchgeführten
> Korrektheits-Umbau der Serverplattform und vor der endgültigen
> Sensormontage.**
>
> Konkret wurden diese Werte gemessen, **bevor**
>
> - die Aggregationslogik repariert wurde (zuvor blieben Wetter-, Feiertags-
>   und Semesterinformationen dauerhaft unberücksichtigt, siehe Abschnitt
>   „Aggregationsproblematik"),
> - die Öffnungszeiten-Kennzeichnung korrekt aus dem Kalender abgeleitet
>   wurde (zuvor dauerhaft auf einem falschen Wert hängend),
> - und **bevor der Sensor an seiner endgültigen, korrigierten Position
>   montiert wurde** — alle bisherigen Zähldaten stammen aus einer
>   vorläufigen Testaufstellung mit abweichender Geometrie.
>
> Diese Werte beschreiben damit ausschließlich die interne Konsistenz einer
> frühen, technisch noch unvollständigen Testphase. Sie lassen **keinen**
> Rückschluss auf die tatsächliche Zählgenauigkeit, Prognosequalität oder
> Modellleistung nach der endgültigen Montage und dem reparierten
> Datenfluss zu und sollten nicht als aktueller Leistungsstand
> missverstanden werden.
>
> **Belastbare neue Kennzahlen sind frühestens verfügbar, sobald**
> (1) der Sensor dauerhaft an der vorgesehenen Position montiert ist,
> (2) daraus mindestens einige Wochen durchgehender Betriebsdaten
> vorliegen, und (3) mindestens ein reguläres, automatisches Training
> stattgefunden hat, dessen Ergebnis den in Abschnitt „Training und
> Bewertung" beschriebenen Vergleichstest gegen die Baseline-Prognose
> tatsächlich besteht. Bis dahin sollte in Gesprächen mit Dritten
> (Bibliotheksleitung, Hochschulverwaltung) ausdrücklich auf den
> vorläufigen, nicht validierten Charakter aller bisherigen Zahlen
> hingewiesen werden.

**Cross-reference to add** in Section 3 ("Aktueller Übergabestatus"),
appended to the existing sentence about the LSTM model not yet being
sufficiently informative:

> *(Siehe Hinweis zur Einordnung aller bisherigen Test- und
> Genauigkeitsangaben, Abschnitt 6.)*

---

## Part 7 — Deviations and confirmed root causes

### Where implementation differed from the original specification, and why

- **Sensor-config activation mechanism** was not explicit in the original
  correctness-overhaul specification but was added as an operational
  necessity: without an explicit "which physical sensor is active" flag
  (mirroring the pattern already used for `model_versions.is_active`),
  ingest after a remount would have had no principled way to attribute new
  data to the new mount, short of guessing. Added `sensor_configs` with an
  `is_active` flag and a one-time activation script instead.
- **Sequencing of the schema migrations vs. the calendar resolver** was
  deliberately ordered so that migrations `005`–`011` (which give existing
  historical rows new-default placeholder values) run *before* the
  calendar resolver exists, and a separate one-off backfill script
  (`backfillIsOpen.js`) recomputes real `is_open`/`period_type` values only
  once the calendar tables are actually populated — recomputing from a
  stub calendar would have reintroduced exactly the kind of silent drift
  this overhaul exists to eliminate.
- **`loadModel.js`'s feature-count guard** was not named as a distinct task
  in the original plan but was added as a required consequence of the
  18→20 feature change: without it, any previously-active model would still
  load (its saved shape is baked into the file) but crash on the next
  prediction with a tensor-shape mismatch instead of degrading to the
  baseline. Confirmed still necessary and present, re-reading the file this
  pass.
- **`cleanup.js`'s weather-deletion scope** needed a one-line but
  load-bearing fix beyond what the aggregation rewrite alone would have
  required: its nightly delete was unconditional on `source`, and would
  have silently purged the new historical weather backfill every night once
  it reached back further than ten days. Scoped to `source='forecast'`
  only; confirmed present, re-reading the file this pass.

### Which suspected causes were confirmed, which were not

| Suspected cause | Status |
|---|---|
| Aggregation job silently failing on every invocation due to a `JSON.parse()` call on an already-deserialized JSONB value | **Confirmed** — read the exact failing line in the pre-overhaul source directly; matches the symptom (`is_open` stuck `TRUE`, weather columns permanently `NULL`) exactly |
| Aggregation job never creating rows for slots without a real event | **Confirmed** — the pre-overhaul job only ever updated existing rows; writing full-day coverage is new capability, not a restored one |
| ML windowing code slicing positionally over row order rather than by timestamp | **Confirmed directly** — re-read `dataLoader.js`'s replacement (`validWindows.js`) and its test suite this pass. The predecessor code did `rows.slice(i, i+LOOKBACK)` over a SQL result ordered only by `interval_start`, with no check of the actual time gap between consecutive rows. `validWindows.js`'s `isValidWindow()` explicitly checks `thisTime - prevTime !== SLOT_MS` and rejects the window if so. A unit test (`ml/test/validWindows.test.js`, "mirrors the confirmed pilot-data bug") directly encodes this: a single day-boundary gap that the old code would have miscounted as valid windows now yields **zero**. |
| Autoregressive forecast loop anchoring on the last database row instead of "now" | **Confirmed** — `predict.js`'s pre-overhaul seed came from `ORDER BY interval_start DESC LIMIT n`, not `Date.now()`; the 2-hour staleness guard added this pass is a direct fix, re-confirmed present in the current file |
| No promotion gate — every trained model activated unconditionally | **Confirmed** — re-read `trainModel.js`; the promotion gate (`holdout_mae < baseline_mae`) is present and gates `status='active'` |
| `LIBRARY_LAT`/`LIBRARY_LON` env vars being fully dead code | **Confirmed** — `fetchWeather.js` only ever reads `library_lat`/`library_lon` from the `config` table; the env vars have been removed from `.env.example`/`docker-compose.yml` entirely rather than left as dead configuration |

### Root cause of "the scheduler failure" (the aggregation job appearing to do nothing)

Precisely as described above: not a container crash, not a cron
registration failure, not a database connectivity issue — a single
`JSON.parse()` call on a value the Postgres driver had already
deserialized from JSONB into a real JavaScript array, throwing a
`SyntaxError` on every single invocation, caught by an outer `try`/`catch`
that only logged the error to the console and let the cron job "complete"
successfully from Docker's point of view. `docker compose ps` and container
health checks would have shown everything green throughout — this class of
failure is invisible to infrastructure-level monitoring and only surfaces
by reading the application's own error log or, as done here, the source
code directly.

---

## Part 8 — Open points

### Decision required

1. **Nothing from this overhaul is committed or pushed.** `git status`
   confirms 43 modified + 34 untracked files, all uncommitted; `HEAD`
   still points at the pre-overhaul commit. **Consequence of leaving this
   as-is:** the entire correctness overhaul — every fix and every new
   feature this report describes — exists in exactly one place, this local
   working tree, with no backup, no history, and no way to recover it if
   this checkout is lost, corrupted, or overwritten. **Consequence of
   committing/pushing:** normal version control safety, and a real commit
   hash `git log -1` can finally report, resolving 4.3.2.5 properly. This
   is not a stylistic preference — it is the single highest-severity
   operational risk this report identifies.
2. **`max_occupancy` shows 150 in this dev database, not 60 as the
   document states.** Traced to the original, pre-overhaul seed file —
   not something this overhaul changed. **Consequence of not checking
   production:** the widget may display a capacity figure that doesn't
   match what the document (and presumably the library) intends. Needs a
   direct check of the production dashboard's actual configured value
   before this section is finalized.
3. **The semester calendar is only seeded through 2027-03-22** (the end of
   "WS26 Ferien"). **Consequence of not extending it in time:** every
   automated calendar lookup for a date beyond that point will throw
   `UnconfiguredCalendarRangeError` by design (a deliberate refusal to
   silently guess) — meaning the nightly aggregation job would start
   failing loudly for every day past that date until a new
   `calendar_periods` migration is added. See Part 4a for the exact
   procedure; this needs to happen before that date, not after.
4. **Historical weather is not backfilled for the retained pilot-era rows**
   (2026-07-02 through 2026-07-06) on this dev stack — confirmed in Part 2:
   zero `historical`-source `weather_cache` rows exist at all here. Since
   this pilot data is explicitly not meant to train the production model,
   this may not matter in practice — but if the pilot data is to remain
   available for any future manual analysis, someone should decide whether
   to run `backfillWeather.js` against that range once, or explicitly
   accept the gap.

### Only verifiable after remount

- **Real sensor accuracy and count reliability.** The entire "~3.6%
  average deviation" / "exits detected more reliably than entries" framing
  (Part 6) can only be meaningfully re-measured once the sensor is
  installed at its final position — verify via a manual sample count
  compared against the sensor's reported entries/exits over a short,
  supervised window, per the document's own "Bekannte Einschränkungen"
  recommendation for periodic manual plausibility checks.
- **Whether any trained model will actually beat the seasonal baseline on
  real data.** The promotion gate is implemented and unit-tested against
  synthetic data, but its real-world behavior — will a genuinely-trained
  LSTM ever clear the bar on real post-remount occupancy patterns — is
  unknown until a real monthly retrain runs against sufficient real data.
  Verify via the model-versions table on the dashboard after the first few
  real retrains: a string of `status='rejected'` rows would indicate the
  model architecture itself may need revisiting, not just more data.
- **The 2-hour quiet-vs-outage heartbeat heuristic's real false-positive/
  false-negative rate.** No real device heartbeat exists yet to compare
  against (see Deliberate Limitations below); its practical accuracy can
  only be judged once real operational gaps and real quiet stretches can
  be told apart by other means (e.g. a manual visit during a flagged
  outage).
- **Whether 2,000 valid training windows (`ml.min_training_windows`) is a
  reasonable threshold in practice.** Chosen as roughly six weeks of
  continuous data; whether that is enough to produce a model that reliably
  beats the baseline is unknown until real data actually crosses it.

### Deliberate limitations (not bugs, not oversights)

- **12-hour LSTM forecast cap, 7-day view served from the baseline
  instead.** A stated design response to confirmed fixed-point convergence
  in the autoregressive loop (Part 1, 4.3.2.19) — extending the cap would
  reintroduce false precision, not fix a shortcoming.
- **Step-function (not interpolated) hourly-to-half-hourly weather
  mapping.** A stated, reasoned choice (Part 4b) — linear interpolation of
  temperature alone was considered and deliberately not implemented, to
  avoid mixing methods across the three weather fields for a marginal
  benefit on one of them.
- **The quiet-vs-sensor-down heuristic is exactly that, a heuristic.** No
  firmware change was made to the Jetson to add a real fixed-interval
  heartbeat (out of scope for this overhaul, a decision made explicitly
  during planning) — the 2-hour-silence heuristic will misclassify some
  genuinely quiet stretches as outages, and vice versa near the edges of a
  real one, until a real heartbeat exists.
- **No manual override to force a specific forecast source.** Confirmed
  absent by design (Part 3b) — not a missing feature so much as a
  deliberate choice not to let an operator's manual override silently mask
  a model that has stopped being trustworthy.
- **Widget uncertainty indicator still not implemented.** The original
  document's fourth recommendation (Part 1, 4.3.2.21) remains open — see
  Recommended Next Steps below.

### Recommended next steps, in order

1. **Commit, push, and tag this overhaul.** Nothing else on this list
   matters if this step doesn't happen first — see Decision Required #1.
2. **Deploy using the corrected update procedure** (Part 1, 4.3.2.13
   replacement text), including the `db/migrate.sh` step, to whichever
   environment is targeted next — do not repeat the migration-less
   deployment that caused the original 500 errors on the dashboard this
   session.
3. **Directly verify the production `max_occupancy` and coordinate values**
   post-deployment rather than assuming the migration alone reconciles
   them with what this document expects (Decision Required #2).
4. **Extend the semester calendar past 2027-03-22** before that date
   arrives (Decision Required #3, procedure in Part 4a).
5. **After the physical remount**, run `activateSensorConfig.js` exactly
   once with the real mount data (Part 4c) — required for ingest to
   resume working at all, not optional.
6. **Let real post-remount data accumulate**, and watch the automatic
   training-readiness banner (4.3.2.11) rather than guessing when enough
   exists.
7. **Observe the first few real monthly retrains** once eligible, and
   specifically check whether any beats the baseline (Only Verifiable
   After Remount, above) — this is the first point at which the model's
   real quality becomes knowable at all.
8. **Decide on the retained pilot data's historical-weather gap**
   (Decision Required #4) — low priority, since this data is explicitly
   not meant to train the production model.
9. **Implement the still-outstanding widget uncertainty indicator** — the
   original document's fourth recommendation, now lower urgency given the
   12-hour cap and explicit baseline labeling already address much of the
   same concern, but still formally open.

---

## Part 9 — Credentials and security

**Scan performed:**
```bash
git grep -inE '(password|passwort|secret|token|api[_-]?key)' -- \
  ':!*.lock' ':!package-lock.json'
```
112 matches across 20 files, each triaged individually this pass —
**zero real credential values found.**

**Breakdown by what the matches actually are:**

- **Variable/config-key names, not values** (`JWT_SECRET`, `ML_SECRET`,
  `JETSON_API_KEY`, etc.) — in `docker-compose.yml` (referenced only as
  `${VAR_NAME}`, never a literal value) and in route/middleware files
  (`services/api/src/middleware/apiKeyAuth.js`, `jwtAuth.js`,
  `services/ml/src/middleware/mlAuth.js`, `services/api/src/routes/auth.js`)
  where they appear as identifiers in code, not as secret material.
- **Explicit placeholder values in `.env.example`** — e.g.
  `POSTGRES_PASSWORD=change_me_strong_password_here`,
  `JWT_SECRET=change_me_generate_with_openssl_rand_hex_64`. All seven
  matches in this file are `change_me_...` placeholders, confirmed by
  direct inspection — none is a usable value.
- **A schema column name**, not a value — `db/init/001_schema.sql:58`:
  `password_hash TEXT NOT NULL` (the column that stores a bcrypt hash,
  never a plaintext password).
- **UI/documentation prose** — `frontend/src/app/login/page.tsx` (login
  form labels), `README.md` (22 matches, all describing how secrets are
  generated/handled, e.g. "Generate with: openssl rand -hex 64" — no
  literal secret in any of them), `services/api/src/scripts/createUser.js`
  (interactive prompt text).
- **False positives from the regex alone** — `DESIGN.md`'s design-token
  documentation (the word "token" as in "design token," unrelated to
  authentication) and `requirements.md`'s repeated use of "passwordless"
  (describing the public widget's access model, the opposite of a
  credential).
- **`services/scheduler/src/jobs/monthlyRetrain.js`/`generateForecasts.js`/
  `services/api/src/services/mlClient.js`/`routes/ingest.js`** — all match
  on the identifier `ML_SECRET`/`JETSON_API_KEY` used exactly as intended.

**No `.env` file is tracked by git** — confirmed via
`git ls-files | grep -i '\.env'`, which returns only `.env.example`.
Consistent with the repository's own commit history, which shows a prior
`removed .env` commit and a `.gitignore` update to exclude all `.env*`
files going forward.

**One unrelated hygiene note, not a credentials issue:** a high-entropy-hash
scan (`git grep -noE '[a-f0-9]{32,}'`) turned up numerous long hex strings
in `frontend/tsconfig.tsbuildinfo` — these are TypeScript's own
content-addressed build-cache hashes, not secrets, but this file is a
generated build artifact that arguably should not be committed at all
(it regenerates automatically). Not a security finding; noted only because
it surfaced during the same scan.

**Conclusion: no credentials of any kind were found checked into this
repository.** This report can be circulated without redaction.
