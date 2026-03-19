-- Fix market orders that were recorded with 5% commission instead of 1.5%
-- Recalculates commission_pi, net_pi, seller_net_pi for orders where commission_pct = 5

DO $$
DECLARE
  r RECORD;
  gross DECIMAL(18,7);
  new_commission DECIMAL(18,7);
  new_net DECIMAL(18,7);
  new_pct DECIMAL(5,2) := 1.5;
BEGIN
  FOR r IN
    SELECT o.id AS order_id, o.amount_pi
    FROM orders o
    WHERE o.status = 'completed'
      AND o.listing_id IS NOT NULL
      AND (o.commission_pct = 5 OR ROUND(o.commission_pct::numeric, 2) = 5)
  LOOP
    gross := r.amount_pi;
    new_commission := ROUND((gross * 0.015)::numeric, 7);
    new_net := ROUND((gross - new_commission)::numeric, 7);

    -- Update orders
    UPDATE orders
    SET commission_pct = new_pct,
        commission_pi = new_commission,
        seller_net_pi = new_net,
        updated_at = NOW()
    WHERE id = r.order_id;

    -- Update seller_earnings
    UPDATE seller_earnings
    SET commission_pct = new_pct,
        commission_pi = new_commission,
        net_pi = new_net,
        updated_at = NOW()
    WHERE order_id = r.order_id AND platform = 'market';

    -- Update admin_revenue
    UPDATE admin_revenue
    SET commission_pct = new_pct,
        commission_pi = new_commission
    WHERE order_id = r.order_id AND platform = 'market';

    RAISE NOTICE 'Fixed order %: gross=% commission=% new_commission=% new_net=%',
      r.order_id, gross, gross * 0.05, new_commission, new_net;
  END LOOP;
END $$;
