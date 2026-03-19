-- OPTIONAL: Run this ONLY if you withdrew 0.05 π before the fix and balance didn't deduct
-- Sets owner_withdrawn to 0.05 if it's currently 0 or missing
-- Run in Supabase SQL Editor: supabase db push (or run this file manually)
INSERT INTO platform_config (key, value, description, updated_at)
VALUES ('treasury_owner_withdrawn_total_pi', '0.05', 'Total owner treasury withdrawals (Pi)', NOW())
ON CONFLICT (key) DO UPDATE SET
  value = CASE
    WHEN COALESCE(NULLIF(TRIM(platform_config.value), ''), '0')::DECIMAL = 0 THEN '0.05'
    ELSE platform_config.value
  END,
  updated_at = NOW();
