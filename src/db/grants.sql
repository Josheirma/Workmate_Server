-- Run once. Replace CHANGE_ME with a strong password before running:
--   openssl rand -base64 32
-- Then update DATABASE_URL in .env.local to match.

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'workmate_app') THEN
    CREATE USER workmate_app WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  END IF;
END $$;

GRANT INSERT, SELECT, UPDATE ON serials            TO workmate_app;
GRANT INSERT                 ON activation_logs    TO workmate_app;
GRANT INSERT, SELECT, UPDATE ON idempotency_keys   TO workmate_app;
GRANT INSERT, SELECT, UPDATE ON download_tokens    TO workmate_app;
GRANT USAGE, SELECT ON SEQUENCE serials_id_seq              TO workmate_app;
GRANT USAGE, SELECT ON SEQUENCE activation_logs_id_seq      TO workmate_app;
