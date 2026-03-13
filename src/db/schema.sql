-- ─────────────────────────────────────────────
-- WORKMATE LICENSE SCHEMA
-- ─────────────────────────────────────────────

-- CREATE TABLE serials (
--   id              SERIAL PRIMARY KEY,
--   serial          VARCHAR(20)  UNIQUE NOT NULL,
--   used            BOOLEAN      DEFAULT false,
--   type            VARCHAR(10)  NOT NULL CHECK (type IN ('box', 'online')),
--   email           VARCHAR(255) DEFAULT NULL,
--   machine_id      VARCHAR(64)  DEFAULT NULL,
--   activated_at    TIMESTAMP    DEFAULT NULL,
--   created_at      TIMESTAMP    DEFAULT NOW()
-- );

-- CREATE TABLE activation_logs (
--   id            SERIAL PRIMARY KEY,
--   serial        VARCHAR(20)  DEFAULT NULL,
--   machine_id    VARCHAR(64)  DEFAULT NULL,
--   ip_address    VARCHAR(45)  DEFAULT NULL,
--   success       BOOLEAN      NOT NULL,
--   reason        VARCHAR(100) DEFAULT NULL,
--   attempted_at  TIMESTAMP    DEFAULT NOW()
-- );

-- -- Indexes
-- CREATE INDEX idx_serials_serial    ON serials (serial);
-- CREATE INDEX idx_logs_serial       ON activation_logs (serial);
-- CREATE INDEX idx_logs_ip           ON activation_logs (ip_address);
-- CREATE INDEX idx_logs_attempted_at ON activation_logs (attempted_at);

-- -- Limited user
-- CREATE USER workmate_app WITH PASSWORD 'pass123$';
-- GRANT INSERT, SELECT, UPDATE ON serials            TO workmate_app;
-- GRANT INSERT                 ON activation_logs    TO workmate_app;
-- GRANT USAGE, SELECT          ON SEQUENCE serials_id_seq         TO workmate_app;
-- GRANT USAGE, SELECT          ON SEQUENCE activation_logs_id_seq TO workmate_app;

-- ─────────────────────────────────────────────
-- WORKMATE LICENSE SCHEMA
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS serials (
  id              SERIAL PRIMARY KEY,
  serial          VARCHAR(20)  UNIQUE NOT NULL,
  used            BOOLEAN      DEFAULT false,
  type            VARCHAR(10)  NOT NULL CHECK (type IN ('box', 'online')),
  email           VARCHAR(255) DEFAULT NULL,
  machine_id      VARCHAR(64)  DEFAULT NULL,
  activated_at    TIMESTAMP    DEFAULT NULL,
  created_at      TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activation_logs (
  id            SERIAL PRIMARY KEY,
  serial        VARCHAR(20)  DEFAULT NULL,
  machine_id    VARCHAR(64)  DEFAULT NULL,
  ip_address    VARCHAR(45)  DEFAULT NULL,
  success       BOOLEAN      NOT NULL,
  reason        VARCHAR(100) DEFAULT NULL,
  attempted_at  TIMESTAMP    DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_serials_serial    ON serials (serial);
CREATE INDEX IF NOT EXISTS idx_logs_serial       ON activation_logs (serial);
CREATE INDEX IF NOT EXISTS idx_logs_ip           ON activation_logs (ip_address);
CREATE INDEX IF NOT EXISTS idx_logs_attempted_at ON activation_logs (attempted_at);

GRANT INSERT, SELECT, UPDATE ON serials            TO workmate_app;
GRANT INSERT                 ON activation_logs    TO workmate_app;
GRANT USAGE, SELECT          ON SEQUENCE serials_id_seq         TO workmate_app;
GRANT USAGE, SELECT          ON SEQUENCE activation_logs_id_seq TO workmate_app;