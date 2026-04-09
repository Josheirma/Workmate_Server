-- run this once, or re-run anytime permissions need fixing
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'workmate_app') THEN
    CREATE USER workmate_app WITH PASSWORD 'pass123';
  END IF;
END $$;

GRANT INSERT, SELECT, UPDATE ON serials           TO workmate_app;
GRANT INSERT                 ON activation_logs   TO workmate_app;
GRANT USAGE, SELECT ON SEQUENCE serials_id_seq         TO workmate_app;
GRANT USAGE, SELECT ON SEQUENCE activation_logs_id_seq TO workmate_app;