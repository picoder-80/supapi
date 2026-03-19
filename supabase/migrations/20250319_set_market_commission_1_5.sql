-- Set SupaMarket commission to 1.5% (was default 5%)
-- Run this to sync platform_config with your intended rate
INSERT INTO platform_config (key, value, description, updated_at) VALUES
  ('market_commission_pct', '1.5', 'Marketplace commission percentage'),
  ('commission_market', '1.5', 'Alias for market commission')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
