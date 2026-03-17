-- Seed SupaChat transfer commission config (admin-editable via Platform Administration)
INSERT INTO platform_config (key, value, description) VALUES
  ('supachat_transfer_commission_pct', '2', 'SupaChat transfer commission % (DM tips, room tips, SupaSpace tips)')
ON CONFLICT (key) DO NOTHING;
