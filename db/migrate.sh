#!/bin/sh
# Applies pending db/init/NNN_*.sql migrations (004 onward) to a database
# that already has data -- docker-entrypoint-initdb.d only ever runs on a
# brand-new, empty data volume, so an existing deployment has no other way
# to pick up schema changes.
#
# Deliberately NOT placed inside db/init/: postgres's entrypoint sources
# (". $f") any *.sh file it finds there that isn't marked executable, running
# it inside the entrypoint's own shell -- an `exit 1` in this script would
# then abort the whole bootstrap sequence on a fresh volume. Piping it via
# stdin instead means it never gets auto-scanned at all.
#
# Usage (run from the repo root, against the running stack):
#   docker compose exec -T db sh < db/migrate.sh
#
# 001-003 are bootstrap-only and are never (re-)applied here -- they already
# ran, implicitly, on whatever volume this database lives on.

set -eu

: "${POSTGRES_USER:?POSTGRES_USER not set in the db container environment}"
: "${POSTGRES_DB:?POSTGRES_DB not set in the db container environment}"

INIT_DIR=/docker-entrypoint-initdb.d
PSQL="psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB"

$PSQL -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" >/dev/null

applied_any=0

for f in "$INIT_DIR"/0*.sql; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  num=${base%%_*}

  case "$num" in
    001|002|003) continue ;;
  esac

  already=$($PSQL -tAc "SELECT 1 FROM schema_migrations WHERE filename = '$base'")
  if [ "$already" = "1" ]; then
    echo "skip   $base (already applied)"
    continue
  fi

  echo "apply  $base"
  if $PSQL -f "$f"; then
    $PSQL -c "INSERT INTO schema_migrations (filename) VALUES ('$base') ON CONFLICT (filename) DO NOTHING;" >/dev/null
    echo "done   $base"
    applied_any=1
  else
    echo "FAILED $base -- aborting; later migrations were not attempted" >&2
    exit 1
  fi
done

if [ "$applied_any" = "0" ]; then
  echo "migrate.sh: nothing to do, all migrations already applied"
else
  echo "migrate.sh: all pending migrations applied"
fi
