-- Backfill seller_earnings for completed orders that have pi_payment_id but no seller_earnings.
-- Also release stuck escrow: seller_earnings with status 'escrow' for completed orders.
-- Fixes: sellers with completed orders but empty earnings (e.g. wandy80, qaisara2020).
-- Root cause: seller_earnings may not have been created during payment complete (race/transient failure).

DO $$
DECLARE
  r RECORD;
  v_commission_pct DECIMAL(5,2);
  v_commission_pi  DECIMAL(18,7);
  v_net_pi          DECIMAL(18,7);
  v_gross_pi        DECIMAL(18,7);
  v_released_count INT;
BEGIN
  -- Get default commission from platform_config
  SELECT COALESCE(
    NULLIF(TRIM((SELECT value FROM platform_config WHERE key = 'commission_market' LIMIT 1)), '')::DECIMAL,
    NULLIF(TRIM((SELECT value FROM platform_config WHERE key = 'market_commission_pct' LIMIT 1)), '')::DECIMAL,
    1.5
  ) INTO v_commission_pct;

  -- 1. Create missing seller_earnings for completed orders
  FOR r IN
    SELECT o.id AS order_id, o.seller_id, o.amount_pi,
           o.commission_pct AS order_commission_pct,
           o.commission_pi  AS order_commission_pi,
           o.seller_net_pi  AS order_net_pi
    FROM orders o
    WHERE o.status = 'completed'
      AND o.pi_payment_id IS NOT NULL
      AND o.listing_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM seller_earnings se WHERE se.order_id = o.id)
  LOOP
    v_gross_pi := r.amount_pi;

    -- Use order's commission if available, else compute
    IF r.order_commission_pct IS NOT NULL AND r.order_commission_pct > 0 THEN
      v_commission_pct := r.order_commission_pct;
      v_commission_pi  := COALESCE(r.order_commission_pi, ROUND((v_gross_pi * v_commission_pct / 100)::numeric, 7));
      v_net_pi          := COALESCE(r.order_net_pi, ROUND((v_gross_pi - v_commission_pi)::numeric, 7));
    ELSE
      v_commission_pi := ROUND((v_gross_pi * v_commission_pct / 100)::numeric, 7);
      v_net_pi        := ROUND((v_gross_pi - v_commission_pi)::numeric, 7);
    END IF;

    -- Insert seller_earnings (status pending = released, seller can withdraw after hold)
    INSERT INTO seller_earnings (
      seller_id, order_id, platform, gross_pi, commission_pct, commission_pi, net_pi, status
    ) VALUES (
      r.seller_id, r.order_id, 'market', v_gross_pi, v_commission_pct, v_commission_pi, v_net_pi, 'pending'
    );

    -- Insert admin_revenue for commission tracking
    INSERT INTO admin_revenue (platform, order_id, gross_pi, commission_pi, commission_pct)
    VALUES ('market', r.order_id, v_gross_pi, v_commission_pi, v_commission_pct);

    RAISE NOTICE 'Backfilled seller_earnings for order %: seller=%, net_pi=%',
      r.order_id, r.seller_id, v_net_pi;
  END LOOP;

  -- 2. Release stuck escrow: seller_earnings still 'escrow' for completed orders
  WITH released AS (
    UPDATE seller_earnings se
    SET status = 'pending', updated_at = NOW()
    FROM orders o
    WHERE se.order_id = o.id
      AND o.status = 'completed'
      AND se.status = 'escrow'
    RETURNING se.id
  )
  SELECT COUNT(*)::INT FROM released INTO v_released_count;
  IF v_released_count > 0 THEN
    RAISE NOTICE 'Released % stuck escrow record(s) to pending', v_released_count;
  END IF;

  -- 3. Ensure admin_revenue exists for released escrow (in case it was missed)
  INSERT INTO admin_revenue (platform, order_id, gross_pi, commission_pi, commission_pct)
  SELECT se.platform, se.order_id, se.gross_pi, se.commission_pi, se.commission_pct
  FROM seller_earnings se
  JOIN orders o ON o.id = se.order_id AND o.status = 'completed'
  WHERE se.status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM admin_revenue ar WHERE ar.order_id = se.order_id);
END $$;
