-- ─────────────────────────────────────────────
-- WORKMATE LICENSE SCHEMA
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS serials (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  email_sent BOOLEAN      NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_serials_email        ON serials (email);
CREATE INDEX IF NOT EXISTS idx_serials_email_unsent ON serials (email_sent)
  WHERE email_sent = false;

-- Limited user
-- CREATE USER workmate_app WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
-- GRANT INSERT, SELECT, UPDATE ON serials TO workmate_app;
-- GRANT USAGE, SELECT ON SEQUENCE serials_id_seq TO workmate_app;
