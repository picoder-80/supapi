-- Optional photos attached to a review (e.g. SupaMarket buyer rates seller)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN reviews.images IS 'Public storage URLs for review photos (max enforced in app)';
