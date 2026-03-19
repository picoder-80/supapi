-- SupaScrow dispute case-management fields (backward-compatible)
ALTER TABLE IF EXISTS public.supascrow_disputes
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS buyer_refund_amount_pi DECIMAL(18,7),
  ADD COLUMN IF NOT EXISTS seller_release_amount_pi DECIMAL(18,7),
  ADD COLUMN IF NOT EXISTS reopened_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Backfill status from legacy resolution semantics
UPDATE public.supascrow_disputes
SET status = CASE
  WHEN resolution IS NULL OR resolution = 'pending' THEN 'open'
  ELSE 'resolved'
END
WHERE status IS NULL;

-- Backfill activity clock
UPDATE public.supascrow_disputes
SET last_activity_at = COALESCE(updated_at, created_at, NOW())
WHERE last_activity_at IS NULL;

-- Constraint: status domain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'supascrow_disputes_status_check'
  ) THEN
    ALTER TABLE public.supascrow_disputes
      ADD CONSTRAINT supascrow_disputes_status_check
      CHECK (status IN ('open','in_review','waiting_party','resolved','closed','reopened'));
  END IF;
END $$;

-- Constraint: priority domain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'supascrow_disputes_priority_check'
  ) THEN
    ALTER TABLE public.supascrow_disputes
      ADD CONSTRAINT supascrow_disputes_priority_check
      CHECK (priority IN ('low','normal','high','urgent'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supascrow_disputes_status_created
  ON public.supascrow_disputes(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supascrow_disputes_assignee_status
  ON public.supascrow_disputes(assigned_admin_id, status, created_at DESC);
