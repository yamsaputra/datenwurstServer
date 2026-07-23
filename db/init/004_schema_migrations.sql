-- Tracks which db/init/*.sql migration files have been applied to a given
-- database. 001-003 are bootstrap-only (they run once, automatically, via
-- docker-entrypoint-initdb.d, only on a brand-new empty data volume) and are
-- never recorded here. Everything from 004 onward is idempotent and gets
-- recorded by db/migrate.sh, so it can also be applied to an existing,
-- already-running database that will never see docker-entrypoint-initdb.d
-- run again (see the "Migrations" section in README.md).

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
