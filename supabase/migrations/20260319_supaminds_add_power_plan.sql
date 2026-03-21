-- Add SupaMinds heavy tier (Power)
INSERT INTO public.mind_plans (code, name, price_usd, interval_unit, interval_count, active, features)
VALUES (
  'power_monthly',
  'Power Monthly',
  24.99,
  'month',
  1,
  TRUE,
  '{"monthly_limit":1800,"priority":"highest","max_context":"extended"}'::jsonb
)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  price_usd = EXCLUDED.price_usd,
  active = EXCLUDED.active,
  features = EXCLUDED.features,
  updated_at = NOW();
