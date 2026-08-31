-- ─────────────────────────────────────────────
-- WORKMATE LICENSE SCHEMA
-- ─────────────────────────────────────────────


-- /*THIS IS A SCHEMA FOR A DATABSE THAT DOESNT EXIST (DELETED)*/
-- CREATE TABLE IF NOT EXISTS serials (
--   id              SERIAL PRIMARY KEY,
--   username        VARCHAR(100) NOT NULL,
--   email_address   VARCHAR(255) NOT NULL,
--   time_stamp      TIMESTAMP    NOT NULL DEFAULT NOW(),
--   product_type    VARCHAR(50)  NOT NULL,      -- e.g. 'internet' (online) or 'box' (proof-of-purchase)
--   proofofpurchase VARCHAR(255),               -- box activation code, null for online purchases
--   email_sent      BOOLEAN      NOT NULL DEFAULT false
-- );

-- CREATE INDEX IF NOT EXISTS idx_serials_email_address ON serials (email_address);
-- CREATE INDEX IF NOT EXISTS idx_serials_email_unsent   ON serials (email_sent)
--   WHERE email_sent = false;
-- CREATE INDEX IF NOT EXISTS idx_serials_proofofpurchase ON serials (proofofpurchase);

-- -- Limited user
-- -- CREATE USER workmate_app WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
-- -- GRANT INSERT, SELECT, UPDATE ON serials TO workmate_app;
-- -- GRANT USAGE, SELECT ON SEQUENCE serials_id_seq TO workmate_app;





-- ─────────────────────────────────────────────
-- WORKMATE SERIALS TABLE
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS serials (

  -- Identity
  id              SERIAL       PRIMARY KEY,
  serial          VARCHAR(20)  UNIQUE NOT NULL,
  type            VARCHAR(10)  NOT NULL CHECK (type IN ('box', 'online')),

  -- Activation state
  -- used            BOOLEAN      NOT NULL DEFAULT false,
  activated_at    TIMESTAMPTZ  DEFAULT NULL,

  -- Customer
  username        VARCHAR(255) DEFAULT NULL,
  email           VARCHAR(255) DEFAULT NULL,

  -- Email delivery tracking
  send_attempts   INTEGER      NOT NULL DEFAULT 0,
  manual_resends  INTEGER      NOT NULL DEFAULT 0,
  sent_at         TIMESTAMPTZ  DEFAULT NULL,

  -- Additional license timestamps
  license2        TIMESTAMPTZ  DEFAULT NULL,
  license3        TIMESTAMPTZ  DEFAULT NULL,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────

-- Worker's hot path: unsent, unclaimed rows.
CREATE INDEX IF NOT EXISTS idx_serials_pending
  ON serials (id)
  WHERE sent_at IS NULL AND send_attempts < 1;

-- Admin stuck list.
CREATE INDEX IF NOT EXISTS idx_serials_stuck
  ON serials (id DESC)
  WHERE sent_at IS NULL AND send_attempts >= 1;

-- Online claim path.
CREATE INDEX IF NOT EXISTS idx_serials_online_claim
  ON serials (id)
  WHERE type = 'online' AND used = false;


-- ─────────────────────────────────────────────
-- GRANTS
-- ─────────────────────────────────────────────

-- GRANT INSERT, SELECT, UPDATE ON serials        TO workmate_app;
-- GRANT USAGE, SELECT ON SEQUENCE serials_id_seq TO workmate_app;