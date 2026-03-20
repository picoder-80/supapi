-- SupArcade: prevent duplicate earn rows for the same session (race-safe at DB level).
-- 1) Fix wallet totals for historical duplicates (keep earliest earn row per session).
-- 2) Remove duplicate earn rows.
-- 3) Unique partial index so concurrent /complete cannot insert twice.

-- ── 1) Subtract excess SC that was credited more than once per session ─────────
WITH ranked AS (
  SELECT
    id,
    user_id,
    ref_id,
    trunc(coalesce(amount, 0))::bigint AS amt,
    row_number() OVER (PARTITION BY user_id, ref_id ORDER BY created_at ASC) AS rn
  FROM public.credit_transactions
  WHERE type = 'earn'
    AND activity = 'arcade_play_complete'
    AND ref_id IS NOT NULL
),
agg AS (
  SELECT
    user_id,
    sum(CASE WHEN rn > 1 THEN amt ELSE 0 END) AS excess_sc
  FROM ranked
  GROUP BY user_id
  HAVING sum(CASE WHEN rn > 1 THEN 1 ELSE 0 END) > 0
)
UPDATE public.supapi_credits w
SET
  balance = greatest(0, trunc(coalesce(w.balance, 0)) - trunc(coalesce(a.excess_sc, 0))),
  total_earned = greatest(0, trunc(coalesce(w.total_earned, 0)) - trunc(coalesce(a.excess_sc, 0))),
  updated_at = now()
FROM agg a
WHERE w.user_id = a.user_id;

-- ── 2) Keep only the earliest earn per (user_id, ref_id) ───────────────────────
DELETE FROM public.credit_transactions ct
WHERE ct.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY user_id, ref_id
        ORDER BY created_at ASC
      ) AS rn
    FROM public.credit_transactions
    WHERE type = 'earn'
      AND activity = 'arcade_play_complete'
      AND ref_id IS NOT NULL
  ) x
  WHERE x.rn > 1
);

-- ── 3) Enforce uniqueness for future inserts ───────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS credit_tx_arcade_earn_session_uid
  ON public.credit_transactions (user_id, ref_id)
  WHERE type = 'earn'
    AND activity = 'arcade_play_complete'
    AND ref_id IS NOT NULL;
