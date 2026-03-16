-- Add tracking_carrier and tracking_url to orders for worldwide courier support
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_carrier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
