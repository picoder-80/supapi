-- SupaMarket paid promotion tables

CREATE TABLE IF NOT EXISTS market_spotlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  sc_cost INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_spotlights_listing ON market_spotlights(listing_id);
CREATE INDEX IF NOT EXISTS idx_market_spotlights_category ON market_spotlights(category);
CREATE INDEX IF NOT EXISTS idx_market_spotlights_active ON market_spotlights(is_active, expires_at);

CREATE TABLE IF NOT EXISTS market_autoreposts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interval_hours INT NOT NULL CHECK (interval_hours IN (6, 12, 24)),
  sc_cost INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_run_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_autoreposts_listing ON market_autoreposts(listing_id);
CREATE INDEX IF NOT EXISTS idx_market_autoreposts_next_run ON market_autoreposts(is_active, next_run_at);

CREATE TABLE IF NOT EXISTS market_carousel_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  headline TEXT NOT NULL,
  cta_label TEXT NOT NULL DEFAULT 'View',
  link_url TEXT NOT NULL,
  sc_cost INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_carousel_ads_active ON market_carousel_ads(is_active, expires_at);
