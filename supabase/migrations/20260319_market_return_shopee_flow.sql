-- Shopee-style market return flow:
-- seller approves return first, buyer ships back item, seller confirms receipt, then refund executes.
ALTER TABLE public.market_return_requests
  DROP CONSTRAINT IF EXISTS market_return_requests_status_check;

ALTER TABLE public.market_return_requests
  ADD CONSTRAINT market_return_requests_status_check
  CHECK (
    status IN (
      'pending_seller',
      'seller_approved_return',
      'buyer_return_shipped',
      'seller_rejected',
      'buyer_cancelled',
      'refunded',
      'escalated'
    )
  );

ALTER TABLE public.market_return_requests
  ADD COLUMN IF NOT EXISTS buyer_return_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS buyer_return_tracking_carrier TEXT,
  ADD COLUMN IF NOT EXISTS buyer_return_note TEXT,
  ADD COLUMN IF NOT EXISTS buyer_return_shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS buyer_return_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_confirmed_return_at TIMESTAMPTZ;

COMMENT ON COLUMN public.market_return_requests.buyer_return_tracking_number IS 'Buyer-provided tracking number for returning item to seller';
