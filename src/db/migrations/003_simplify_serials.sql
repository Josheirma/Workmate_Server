-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 003 — Simplify serials table
-- Run once:  psql $DATABASE_URL -f src/db/migrations/003_simplify_serials.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE serials DROP COLUMN IF EXISTS retry_count;
ALTER TABLE serials DROP COLUMN IF EXISTS created_at;
