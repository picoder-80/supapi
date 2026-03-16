-- Ensure marketplace/gig status transitions are compatible with current app flow.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (
    status IN (
      'pending',
      'paid',
      'escrow',
      'shipped',
      'meetup_set',
      'delivered',
      'completed',
      'disputed',
      'refunded',
      'cancelled',
      'accepted',
      'in_progress'
    )
  );
