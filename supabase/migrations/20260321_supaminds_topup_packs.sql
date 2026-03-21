-- SupaMinds add-on topup packs for extra prompts
CREATE TABLE IF NOT EXISTS public.mind_topup_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  prompts INT NOT NULL CHECK (prompts > 0),
  price_usd NUMERIC(12,2) NOT NULL CHECK (price_usd >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mind_topup_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES public.mind_topup_packs(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES public.mind_invoices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','consumed','cancelled')),
  prompts_total INT NOT NULL CHECK (prompts_total > 0),
  prompts_used INT NOT NULL DEFAULT 0 CHECK (prompts_used >= 0),
  prompts_remaining INT NOT NULL CHECK (prompts_remaining >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mind_topup_ledger_user
  ON public.mind_topup_ledger(user_id, status, created_at DESC);

INSERT INTO public.mind_topup_packs (code, name, prompts, price_usd, active, sort_order)
VALUES
  ('topup_100', 'Topup 100', 100, 2.99, TRUE, 10),
  ('topup_300', 'Topup 300', 300, 7.99, TRUE, 20),
  ('topup_1000', 'Topup 1000', 1000, 19.99, TRUE, 30)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  prompts = EXCLUDED.prompts,
  price_usd = EXCLUDED.price_usd,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
