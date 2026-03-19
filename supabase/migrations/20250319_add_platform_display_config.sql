-- Platform display labels and emojis for Treasury Commission Rates (dynamic config)
-- Enables Treasury to show platform names from config instead of hardcoded maps
INSERT INTO platform_config (key, value, description) VALUES
  ('platform_label_market', 'SupaMarket', 'Display name for market platform'),
  ('platform_emoji_market', '🛍️', 'Emoji for market platform'),
  ('platform_label_gigs', 'SupaSkil', 'Display name for gigs platform'),
  ('platform_emoji_gigs', '💼', 'Emoji for gigs platform'),
  ('platform_label_supascrow', 'SupaScrow', 'Display name for supascrow platform'),
  ('platform_emoji_supascrow', '🛡️', 'Emoji for supascrow platform'),
  ('platform_label_supaendoro', 'SupaEndoro', 'Display name for supaendoro platform'),
  ('platform_emoji_supaendoro', '🚗', 'Emoji for supaendoro platform'),
  ('platform_label_domus', 'SupaDomus', 'Display name for domus platform'),
  ('platform_emoji_domus', '🏠', 'Emoji for domus platform'),
  ('platform_label_bulkhub', 'SupaBulk', 'Display name for bulkhub platform'),
  ('platform_emoji_bulkhub', '📦', 'Emoji for bulkhub platform')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
