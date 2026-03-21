-- SupaMinds monthly usage metering for server-side quota enforcement
CREATE TABLE IF NOT EXISTS public.mind_usage_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_ym TEXT NOT NULL, -- YYYY-MM
  plan_code TEXT NOT NULL,
  requests_count INT NOT NULL DEFAULT 0 CHECK (requests_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_ym)
);

CREATE INDEX IF NOT EXISTS idx_mind_usage_monthly_user
  ON public.mind_usage_monthly(user_id, period_ym DESC);
