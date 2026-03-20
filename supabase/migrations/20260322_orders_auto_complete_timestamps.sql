-- Shopee-style auto timelines: when seller fulfilled (ship/meetup), when buyer received (delivered)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.fulfilled_at IS 'First time order reached shipped or meetup_set (auto receipt countdown)';
COMMENT ON COLUMN public.orders.delivered_at IS 'When buyer or system marked delivered (auto complete countdown)';
