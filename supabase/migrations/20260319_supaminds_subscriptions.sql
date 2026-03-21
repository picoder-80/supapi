-- SupaMinds subscriptions (USD-pegged, Pi checkout)
CREATE TABLE IF NOT EXISTS public.mind_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_usd NUMERIC(12,2) NOT NULL CHECK (price_usd >= 0),
  interval_unit TEXT NOT NULL DEFAULT 'month' CHECK (interval_unit IN ('month')),
  interval_count INT NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.mind_plans (code, name, price_usd, interval_unit, interval_count, active, features)
VALUES
  ('free', 'Free', 0, 'month', 1, TRUE, '{"daily_limit":20,"priority":"standard"}'::jsonb),
  ('pro_monthly', 'Pro Monthly', 12.99, 'month', 1, TRUE, '{"monthly_limit":600,"priority":"high"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.mind_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.mind_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','past_due','grace','canceled','expired')),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  grace_until TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mind_subscriptions_user
  ON public.mind_subscriptions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.mind_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.mind_subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.mind_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'quote'
    CHECK (status IN ('quote','pending','paid','cancelled','expired','failed')),
  amount_usd NUMERIC(12,2) NOT NULL CHECK (amount_usd >= 0),
  pi_usd_rate NUMERIC(18,8) NOT NULL CHECK (pi_usd_rate > 0),
  spread_pct NUMERIC(8,4) NOT NULL DEFAULT 0.015,
  amount_pi NUMERIC(18,6) NOT NULL CHECK (amount_pi > 0),
  quote_expires_at TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mind_invoices_user
  ON public.mind_invoices(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mind_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.mind_invoices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'pi',
  provider_payment_id TEXT NOT NULL,
  txid TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','completed','failed')),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_mind_payments_invoice
  ON public.mind_payments(invoice_id, created_at DESC);
