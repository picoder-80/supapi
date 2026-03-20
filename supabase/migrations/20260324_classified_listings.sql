-- Supasifieds: classified ads (no Pi escrow). Boost with SupaCredits only.

CREATE TABLE IF NOT EXISTS classified_listings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL,
  subcategory      TEXT,
  category_deep    TEXT NOT NULL DEFAULT '',
  price_display    TEXT,
  images           TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'active',
  location         TEXT,
  country_code     TEXT,
  contact_phone    TEXT,
  contact_whatsapp TEXT,
  views            INT NOT NULL DEFAULT 0,
  is_boosted       BOOLEAN NOT NULL DEFAULT FALSE,
  boost_tier       TEXT,
  boost_expires_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT classified_listings_status_check CHECK (
    status IN ('active', 'paused', 'deleted', 'removed')
  ),
  CONSTRAINT classified_listings_category_check CHECK (
    category IN (
      'jobs-employment',
      'services',
      'property-rentals',
      'vehicles',
      'electronics-gadgets',
      'furniture-home',
      'fashion-apparel',
      'babies-kids',
      'health-beauty-classifieds',
      'hobbies-sports-classifieds',
      'pets-classifieds',
      'food-beverage-classifieds',
      'business-industrial',
      'education-learning',
      'community-announcements'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_classified_listings_seller   ON classified_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_classified_listings_category ON classified_listings(category);
CREATE INDEX IF NOT EXISTS idx_classified_listings_status   ON classified_listings(status);
CREATE INDEX IF NOT EXISTS idx_classified_listings_created  ON classified_listings(created_at DESC);

CREATE TABLE IF NOT EXISTS classified_boosts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classified_id  UUID NOT NULL REFERENCES classified_listings(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier           TEXT NOT NULL,
  sc_cost        INT NOT NULL,
  duration_hrs   INT NOT NULL,
  boosted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_classified_boosts_classified ON classified_boosts(classified_id);
CREATE INDEX IF NOT EXISTS idx_classified_boosts_user ON classified_boosts(user_id);

CREATE OR REPLACE FUNCTION expire_classified_boosts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE classified_listings
  SET is_boosted = FALSE, boost_tier = NULL, boost_expires_at = NULL, updated_at = NOW()
  WHERE is_boosted = TRUE AND boost_expires_at IS NOT NULL AND boost_expires_at < NOW();
END;
$$;

CREATE OR REPLACE FUNCTION increment_classified_views(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE classified_listings SET views = views + 1 WHERE id = p_id;
END;
$$;

ALTER TABLE classified_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classified_listings_public_read" ON classified_listings;
CREATE POLICY "classified_listings_public_read"
  ON classified_listings FOR SELECT
  USING (status = 'active');

DROP TRIGGER IF EXISTS trg_classified_listings_updated ON classified_listings;
CREATE TRIGGER trg_classified_listings_updated
  BEFORE UPDATE ON classified_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
