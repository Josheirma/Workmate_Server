-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 002 — Email retry columns
-- Run once:  psql $DATABASE_URL -f src/db/migrations/002_email_retry.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- email_sent   — false until sendLicenseEmail() succeeds; retry worker targets false rows
-- retry_count  — incremented on every attempt (success or failure);
--                worker stops retrying after MAX_RETRIES (10) to prevent infinite loops

ALTER TABLE serials
  ADD COLUMN IF NOT EXISTS email_sent   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_count  INTEGER NOT NULL DEFAULT 0;

-- Index so the worker query is fast even with many rows
CREATE INDEX IF NOT EXISTS idx_serials_email_unsent
  ON serials (email_sent, type, created_at)
  WHERE email_sent = false AND type = 'online';
