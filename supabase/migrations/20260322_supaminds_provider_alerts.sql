-- Persist SupaMinds provider runtime alerts (rate-limit / 429 warnings)
CREATE TABLE IF NOT EXISTS public.mind_ai_provider_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'warn' CHECK (level IN ('warn', 'info')),
  message TEXT NOT NULL,
  remaining_requests INT CHECK (remaining_requests >= 0),
  request_limit INT CHECK (request_limit >= 0),
  remaining_pct NUMERIC(6,2),
  reset_at TEXT,
  source TEXT NOT NULL DEFAULT 'runtime',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mind_ai_provider_alerts_created
  ON public.mind_ai_provider_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mind_ai_provider_alerts_provider_created
  ON public.mind_ai_provider_alerts(provider, created_at DESC);
