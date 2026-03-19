-- Buyer-initiated return/refund request before platform dispute (reduces abuse)
CREATE TABLE IF NOT EXISTS public.market_return_requests (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id                  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seller_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category                  TEXT NOT NULL,
  reason                    TEXT NOT NULL,
  evidence                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                    TEXT NOT NULL DEFAULT 'pending_seller'
                            CHECK (status IN (
                              'pending_seller',
                              'seller_rejected',
                              'buyer_cancelled',
                              'refunded',
                              'escalated'
                            )),
  seller_note               TEXT,
  seller_responded_at       TIMESTAMPTZ,
  seller_response_deadline  TIMESTAMPTZ NOT NULL,
  escalated_dispute_id      UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_return_requests_order
  ON public.market_return_requests(order_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_market_return_one_pending
  ON public.market_return_requests(order_id)
  WHERE status = 'pending_seller';

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS source_return_request_id UUID REFERENCES public.market_return_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_disputes_source_return_request
  ON public.disputes(source_return_request_id)
  WHERE source_return_request_id IS NOT NULL;

COMMENT ON TABLE public.market_return_requests IS 'SupaMarket: buyer asks seller for refund first; escalation opens disputes row';
