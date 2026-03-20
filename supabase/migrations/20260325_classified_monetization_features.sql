-- Supasifieds monetization extensions:
-- 1) Category spotlight placements
-- 2) Auto-repost subscriptions
-- 3) Carousel sponsored ads

CREATE TABLE IF NOT EXISTS classified_spotlights (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id       UUID NOT NULL REFERENCES classified_listings(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category         TEXT NOT NULL,
  sc_cost          INT NOT NULL,
  starts_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classified_spotlights_listing ON classified_spotlights(listing_id);
CREATE INDEX IF NOT EXISTS idx_classified_spotlights_category ON classified_spotlights(category);
CREATE INDEX IF NOT EXISTS idx_classified_spotlights_active ON classified_spotlights(is_active, expires_at);

CREATE TABLE IF NOT EXISTS classified_autoreposts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id       UUID NOT NULL REFERENCES classified_listings(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interval_hours   INT NOT NULL CHECK (interval_hours IN (6, 12, 24, 48)),
  sc_cost          INT NOT NULL,
  starts_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_run_at      TIMESTAMPTZ NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  runs_count       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classified_autoreposts_listing ON classified_autoreposts(listing_id);
CREATE INDEX IF NOT EXISTS idx_classified_autoreposts_next_run ON classified_autoreposts(is_active, next_run_at);

CREATE TABLE IF NOT EXISTS classified_carousel_ads (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id       UUID REFERENCES classified_listings(id) ON DELETE SET NULL,
  image_url        TEXT NOT NULL,
  headline         TEXT NOT NULL,
  cta_label        TEXT NOT NULL DEFAULT 'View',
  link_url         TEXT NOT NULL,
  sc_cost          INT NOT NULL,
  starts_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classified_carousel_ads_active ON classified_carousel_ads(is_active, expires_at);

CREATE OR REPLACE FUNCTION expire_classified_promotions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE classified_spotlights
  SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at < NOW();

  UPDATE classified_autoreposts
  SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at < NOW();

  UPDATE classified_carousel_ads
  SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at < NOW();
END;
$$;

CREATE OR REPLACE FUNCTION run_classified_autorepost()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  WITH due AS (
    SELECT id, listing_id, interval_hours
    FROM classified_autoreposts
    WHERE is_active = TRUE
      AND next_run_at <= NOW()
      AND expires_at >= NOW()
    FOR UPDATE SKIP LOCKED
  )
  UPDATE classified_listings l
  SET created_at = NOW(), updated_at = NOW()
  FROM due
  WHERE l.id = due.listing_id
    AND l.status = 'active';

  WITH due AS (
    SELECT id, interval_hours
    FROM classified_autoreposts
    WHERE is_active = TRUE
      AND next_run_at <= NOW()
      AND expires_at >= NOW()
    FOR UPDATE SKIP LOCKED
  )
  UPDATE classified_autoreposts a
  SET next_run_at = NOW() + make_interval(hours => due.interval_hours),
      runs_count = runs_count + 1
  FROM due
  WHERE a.id = due.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN COALESCE(v_count, 0);
END;
$$;
