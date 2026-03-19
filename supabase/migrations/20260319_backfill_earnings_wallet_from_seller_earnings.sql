-- Backfill earnings_wallet + earnings_transactions from seller_earnings
-- for completed marketplace orders.
--
-- Why: some orders can end up with seller_earnings populated (released/pending),
-- but the wallet layer (earnings_wallet/earnings_transactions) never got credited,
-- so Wallet tab and Dashboard "Earnings" show 0.
--
-- Idempotent: skips when earnings_transactions already exists for (seller_id, order_id)
-- with type='market_order'.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      se.order_id,
      se.seller_id,
      se.net_pi
    FROM seller_earnings se
    JOIN orders o ON o.id = se.order_id
    WHERE o.status = 'completed'
      AND o.pi_payment_id IS NOT NULL
      AND se.status IN ('pending','paid')
      AND se.net_pi > 0
      AND NOT EXISTS (
        SELECT 1
        FROM earnings_transactions et
        WHERE et.user_id = se.seller_id
          AND et.type = 'market_order'
          AND et.ref_id = se.order_id::text
      )
  LOOP
    -- Ensure wallet row exists
    INSERT INTO earnings_wallet (user_id)
    VALUES (r.seller_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Credit earnings as available (matches creditSellerEarnings in supamarket order completion)
    UPDATE earnings_wallet
    SET
      available_pi = COALESCE(available_pi, 0) + r.net_pi,
      total_earned  = COALESCE(total_earned, 0) + r.net_pi,
      updated_at    = NOW()
    WHERE user_id = r.seller_id;

    INSERT INTO earnings_transactions (
      user_id,
      type,
      source,
      amount_pi,
      status,
      ref_id,
      note
    ) VALUES (
      r.seller_id,
      'market_order',
      'Marketplace Order Completion',
      r.net_pi,
      'available',
      r.order_id::text,
      'Auto payout for completed order ' || r.order_id::text
    );
  END LOOP;
END $$;

