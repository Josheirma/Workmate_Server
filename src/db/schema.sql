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



CREATE TABLE IF NOT EXISTS serials (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) NOT NULL,
  email_address VARCHAR(255) NOT NULL,
  time_stamp    TIMESTAMP    NOT NULL DEFAULT NOW(),
  product_type  VARCHAR(50)  NOT NULL,   -- 'box' or 'online'
  email_sent    BOOLEAN      NOT NULL DEFAULT false,
  activated     BOOLEAN      NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_serials_email_address ON serials (email_address);
CREATE INDEX IF NOT EXISTS idx_serials_unclaimed_online ON serials (product_type, email_sent, activated)
  WHERE product_type = 'online' AND email_sent = true AND activated = false;