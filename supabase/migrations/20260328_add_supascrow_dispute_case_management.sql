-- SupaScrow dispute case-management fields (backward-compatible)
ALTER TABLE IF EXISTS public.supascrow_disputes
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS evidence JSONB,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS requester_update TEXT,
  ADD COLUMN IF NOT EXISTS partial_buyer_refund_pi DECIMAL(18,7),
  ADD COLUMN IF NOT EXISTS partial_seller_release_pi DECIMAL(18,7);

ALTER TABLE IF EXISTS public.supascrow_disputes
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN priority SET DEFAULT 'normal',
  ALTER COLUMN evidence SET DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supascrow_disputes_status_check'
  ) THEN
    ALTER TABLE public.supascrow_disputes
      ADD CONSTRAINT supascrow_disputes_status_check
      CHECK (status IN ('open','in_review','waiting_party','resolved','closed','reopened'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supascrow_disputes_priority_check'
  ) THEN
    ALTER TABLE public.supascrow_disputes
      ADD CONSTRAINT supascrow_disputes_priority_check
      CHECK (priority IN ('low','normal','high','urgent'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supascrow_disputes_partial_amounts_check'
  ) THEN
    ALTER TABLE public.supascrow_disputes
      ADD CONSTRAINT supascrow_disputes_partial_amounts_check
      CHECK (
        (partial_buyer_refund_pi IS NULL OR partial_buyer_refund_pi >= 0) AND
        (partial_seller_release_pi IS NULL OR partial_seller_release_pi >= 0)
      );
  END IF;
END $$;

-- Backfill legacy rows
UPDATE public.supascrow_disputes
SET
  status = CASE
    WHEN resolution IS NULL OR resolution = 'pending' THEN COALESCE(status, 'open')
    WHEN COALESCE(status, '') = '' THEN 'resolved'
    ELSE status
  END,
  priority = COALESCE(NULLIF(priority, ''), 'normal'),
  evidence = COALESCE(evidence, '[]'::jsonb),
  last_activity_at = COALESCE(last_activity_at, updated_at, created_at)
WHERE
  status IS NULL
  OR priority IS NULL
  OR evidence IS NULL
  OR last_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_supascrow_disputes_status_created
  ON public.supascrow_disputes(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supascrow_disputes_assignee_status_created
  ON public.supascrow_disputes(assigned_admin_id, status, created_at DESC);
