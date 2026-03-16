-- Ensure price_pi is populated from amount_pi when null (DB fallback)
-- Run in Supabase SQL Editor

-- Trigger: sync price_pi ↔ amount_pi on insert/update
CREATE OR REPLACE FUNCTION orders_set_price_pi()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price_pi IS NULL AND NEW.amount_pi IS NOT NULL THEN
    NEW.price_pi := NEW.amount_pi;
  ELSIF NEW.amount_pi IS NULL AND NEW.price_pi IS NOT NULL THEN
    NEW.amount_pi := NEW.price_pi;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_set_price_pi ON orders;
CREATE TRIGGER trg_orders_set_price_pi
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_set_price_pi();
