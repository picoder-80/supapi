-- Ensure users table has kyc_status and wallet_address (safe for existing DBs)
-- Run in Supabase SQL Editor or via migration

-- kyc_status: some older DBs may not have it if created before schema had it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'kyc_status'
  ) THEN
    ALTER TABLE users ADD COLUMN kyc_status TEXT NOT NULL DEFAULT 'unverified';
    ALTER TABLE users ADD CONSTRAINT users_kyc_status_check
      CHECK (kyc_status IN ('unverified','pending','verified'));
  END IF;
END $$;

-- wallet_address
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address TEXT;
