-- Immutable dispute event timeline for forensic and compliance checks.
CREATE TABLE IF NOT EXISTS public.dispute_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL CHECK (platform IN ('market', 'supascrow')),
  dispute_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.supascrow_deals(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'admin', 'system')),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('opened', 'analysis_updated', 'auto_resolved', 'admin_resolved', 'status_changed')),
  from_status TEXT,
  to_status TEXT,
  decision TEXT,
  confidence DECIMAL(3,2),
  reason_excerpt TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_audit_logs_dispute ON public.dispute_audit_logs(dispute_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispute_audit_logs_order ON public.dispute_audit_logs(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispute_audit_logs_deal ON public.dispute_audit_logs(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispute_audit_logs_created ON public.dispute_audit_logs(created_at DESC);
