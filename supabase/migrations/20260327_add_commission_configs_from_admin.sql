-- All commission values must come from admin settings (no hardcoding)
-- Room entry commission (SupaChat paid rooms)
INSERT INTO platform_config (key, value, description) VALUES
  ('supachat_room_entry_commission_pct', '20', 'SupaChat paid room entry commission % (platform fee deducted from entry fee)'),
  ('commission_supaendoro', '5', 'SupaEndoro platform fee % (deducted from rental)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
