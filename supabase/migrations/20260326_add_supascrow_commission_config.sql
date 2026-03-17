-- SupaScrow escrow commission (admin-editable via Platform Administration)
INSERT INTO platform_config (key, value, description) VALUES
  ('commission_supascrow', '5', 'SupaScrow commission % (deducted from seller payout on release)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
