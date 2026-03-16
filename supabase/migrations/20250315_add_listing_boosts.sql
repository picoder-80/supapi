-- listing_boosts table for boost history
CREATE TABLE IF NOT EXISTS listing_boosts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id   UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier         TEXT NOT NULL,
  sc_cost      INT NOT NULL,
  duration_hrs INT NOT NULL,
  boosted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listing_boosts_listing ON listing_boosts(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_boosts_user ON listing_boosts(user_id);

-- RPC to expire listing boosts (clear is_boosted when boost_expires_at < now)
CREATE OR REPLACE FUNCTION expire_listing_boosts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE listings
  SET is_boosted = FALSE, boost_tier = NULL, boost_expires_at = NULL, updated_at = NOW()
  WHERE is_boosted = TRUE AND boost_expires_at IS NOT NULL AND boost_expires_at < NOW();
END;
$$;
