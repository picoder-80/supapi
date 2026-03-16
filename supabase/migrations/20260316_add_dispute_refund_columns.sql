ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS refund_txid TEXT;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS refund_amount_pi NUMERIC;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'pending';
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Allow explicit refunded status for seller_earnings when admin issues buyer refund.
DO $$
BEGIN
  IF to_regclass('public.seller_earnings') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seller_earnings_status_check'
      AND conrelid = 'public.seller_earnings'::regclass
  ) THEN
    ALTER TABLE public.seller_earnings DROP CONSTRAINT seller_earnings_status_check;
  END IF;

  ALTER TABLE public.seller_earnings
    ADD CONSTRAINT seller_earnings_status_check
    CHECK (status IN ('escrow','pending','paid','cancelled','refunded'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Extend dispute audit event types for refund issuance timeline entries.
DO $$
BEGIN
  IF to_regclass('public.dispute_audit_logs') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dispute_audit_logs_event_type_check'
      AND conrelid = 'public.dispute_audit_logs'::regclass
  ) THEN
    ALTER TABLE public.dispute_audit_logs DROP CONSTRAINT dispute_audit_logs_event_type_check;
  END IF;

  ALTER TABLE public.dispute_audit_logs
    ADD CONSTRAINT dispute_audit_logs_event_type_check
    CHECK (event_type IN ('opened','analysis_updated','auto_resolved','admin_resolved','status_changed','refund_issued'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

