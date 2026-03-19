-- Add AI suggestion columns for SupaScrow disputes (safe for existing DBs)
ALTER TABLE IF EXISTS public.supascrow_disputes
  ADD COLUMN IF NOT EXISTS ai_decision TEXT,
  ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);

-- Ensure allowed values/range even on older environments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'supascrow_disputes_ai_decision_check'
  ) THEN
    ALTER TABLE public.supascrow_disputes
      ADD CONSTRAINT supascrow_disputes_ai_decision_check
      CHECK (ai_decision IN ('refund','release','manual_review') OR ai_decision IS NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'supascrow_disputes_ai_confidence_check'
  ) THEN
    ALTER TABLE public.supascrow_disputes
      ADD CONSTRAINT supascrow_disputes_ai_confidence_check
      CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1));
  END IF;
END $$;
