-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 001 — All security schema changes
-- Run once:  psql $DATABASE_URL -f src/db/migrations/001_security.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Version column — optimistic locking on activate
--    Every UPDATE checks AND version = $n so concurrent activations can't both win.
ALTER TABLE serials
  ADD COLUMN IF NOT EXISTS version        INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paypal_order_id VARCHAR(128) UNIQUE DEFAULT NULL;

-- 2. Idempotency keys — one PayPal orderID → one serial, no matter how many retries
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key           VARCHAR(128) PRIMARY KEY,
  status        VARCHAR(16)  NOT NULL CHECK (status IN ('pending','complete','failed')),
  response_body JSONB        DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys (created_at);

-- 3. Single-use download tokens — serial must be activated to get one; each token works once
CREATE TABLE IF NOT EXISTS download_tokens (
  token      VARCHAR(256) PRIMARY KEY,
  serial     VARCHAR(20)  NOT NULL REFERENCES serials(serial),
  used       BOOLEAN      NOT NULL DEFAULT false,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires ON download_tokens (expires_at);

-- 4. Grants for new tables
GRANT INSERT, SELECT, UPDATE ON idempotency_keys TO workmate_app;
GRANT INSERT, SELECT, UPDATE ON download_tokens  TO workmate_app;

-- 5. Cleanup: run nightly via pg_cron or the in-process scheduler in index.ts
-- SELECT cron.schedule('cleanup', '0 3 * * *', $$
--   DELETE FROM activation_logs  WHERE attempted_at < NOW() - INTERVAL '90 days';
--   DELETE FROM idempotency_keys WHERE created_at   < NOW() - INTERVAL '24 hours';
--   DELETE FROM download_tokens  WHERE expires_at   < NOW();
-- $$);
