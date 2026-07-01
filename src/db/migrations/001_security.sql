-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 001 — PayPal idempotency keys
-- Run once:  psql $DATABASE_URL -f src/db/migrations/001_security.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Idempotency keys — one PayPal orderID → one row, no matter how many retries
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key           VARCHAR(128) PRIMARY KEY,
  status        VARCHAR(16)  NOT NULL CHECK (status IN ('pending','complete','failed')),
  response_body JSONB        DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys (created_at);

-- Grants
GRANT INSERT, SELECT, UPDATE ON idempotency_keys TO workmate_app;

-- Cleanup: run nightly via pg_cron or the in-process scheduler in index.ts
-- DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
