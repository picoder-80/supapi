-- ============================================================
-- Supapi — Supabase SQL Schema
-- Jalankan ini dalam Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS ──────────────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pi_uid          TEXT UNIQUE NOT NULL,
  username        TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  email           TEXT,
  role            TEXT NOT NULL DEFAULT 'pioneer'
                  CHECK (role IN ('pioneer','seller','instructor','host','admin')),
  kyc_status      TEXT NOT NULL DEFAULT 'unverified'
                  CHECK (kyc_status IN ('unverified','pending','verified')),
  wallet_address  TEXT,
  wallet_verified BOOLEAN NOT NULL DEFAULT FALSE,
  wallet_verified_at TIMESTAMPTZ,
  kyc_self_declared BOOLEAN NOT NULL DEFAULT FALSE,
  bio             TEXT,
  cover_url       TEXT,
  pi_balance_pending DECIMAL(18,7) NOT NULL DEFAULT 0,
  referral_code   TEXT UNIQUE NOT NULL,
  referred_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen       TIMESTAMPTZ
);

-- Marketplace listings (more detailed, aligned with src/app/api/market/**)
CREATE TABLE listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  price_pi        DECIMAL(18,7) NOT NULL,
  category        TEXT NOT NULL,
  subcategory     TEXT,
  condition       TEXT NOT NULL DEFAULT 'new',
  buying_method   TEXT NOT NULL DEFAULT 'both'
                  CHECK (buying_method IN ('meetup','ship','both')),
  images          TEXT[] NOT NULL DEFAULT '{}',
  stock           INT NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused','sold','deleted')),
  location        TEXT,
  country_code    TEXT,
  ship_worldwide  BOOLEAN NOT NULL DEFAULT FALSE,
  views           INT NOT NULL DEFAULT 0,
  likes           INT NOT NULL DEFAULT 0,
  is_boosted      BOOLEAN NOT NULL DEFAULT FALSE,
  boost_tier      TEXT,
  boost_expires_at TIMESTAMPTZ,
  type            TEXT NOT NULL DEFAULT 'physical',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listings_seller     ON listings(seller_id);
CREATE INDEX idx_listings_category   ON listings(category);
CREATE INDEX idx_listings_status     ON listings(status);

-- ── GIGS (Freelance) ────────────────────────────────────────
CREATE TABLE gigs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL,
  packages         JSONB NOT NULL DEFAULT '[]',
  images           TEXT[] NOT NULL DEFAULT '{}',
  tags             TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','removed')),
  rating_avg       DECIMAL(3,2) NOT NULL DEFAULT 0,
  rating_count     INT NOT NULL DEFAULT 0,
  orders_completed INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ORDERS (Marketplace + Gigs, unified) ─────────────────────
-- Used by marketplace APIs in src/app/api/market/orders/** and payments/complete
-- Supports both product listings and gig-style orders via optional fields.
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Core relations
  listing_id       UUID REFERENCES listings(id),
  gig_id           UUID REFERENCES gigs(id),
  buyer_id         UUID NOT NULL REFERENCES users(id),
  seller_id        UUID NOT NULL REFERENCES users(id),

  -- Amount / commission
  amount_pi        DECIMAL(18,7) NOT NULL,
  commission_pct   DECIMAL(5,2),
  commission_pi    DECIMAL(18,7),
  seller_net_pi    DECIMAL(18,7),

  -- Status lifecycle (marketplace + gigs)
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN (
                     'pending',      -- created, waiting for payment
                     'paid',         -- payment successful, in escrow
                    'escrow',       -- compatibility status on legacy deployments
                     'shipped',      -- seller shipped
                     'meetup_set',   -- meetup arranged
                     'delivered',    -- buyer says received
                     'completed',    -- escrow released
                     'disputed',     -- under dispute
                     'refunded',     -- refunded after dispute
                     'cancelled',    -- cancelled
                     'accepted',     -- (gig) seller accepted
                     'in_progress'   -- (gig) work in progress
                   )),

  -- Marketplace delivery / meetup details
  buying_method    TEXT,
  shipping_name    TEXT,
  shipping_address TEXT,
  shipping_city    TEXT,
  shipping_postcode TEXT,
  shipping_country TEXT,
  tracking_number  TEXT,
  meetup_location  TEXT,
  meetup_time      TIMESTAMPTZ,
  notes            TEXT,

  -- Gig-specific fields (optional)
  package_index    INT,
  requirements     TEXT,
  delivery_url     TEXT,

  -- Pi payment
  pi_payment_id    TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_buyer  ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);

-- ── COURSES (Academy) ───────────────────────────────────────
CREATE TABLE courses (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  price_pi         DECIMAL(18,7) NOT NULL,
  thumbnail_url    TEXT,
  category         TEXT NOT NULL,
  level            TEXT NOT NULL DEFAULT 'beginner'
                   CHECK (level IN ('beginner','intermediate','advanced')),
  is_published     BOOLEAN NOT NULL DEFAULT FALSE,
  enrollment_count INT NOT NULL DEFAULT 0,
  rating_avg       DECIMAL(3,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE course_lessons (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  video_url        TEXT,
  content          TEXT,
  order_index      INT NOT NULL DEFAULT 0,
  duration_minutes INT NOT NULL DEFAULT 0,
  is_free_preview  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE course_enrollments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id   UUID NOT NULL REFERENCES courses(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  pi_payment_id TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);

-- ── STAYS (Airbnb-like) ─────────────────────────────────────
CREATE TABLE stays (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  price_pi_per_night   DECIMAL(18,7) NOT NULL,
  address              TEXT NOT NULL,
  city                 TEXT NOT NULL,
  images               TEXT[] NOT NULL DEFAULT '{}',
  amenities            TEXT[] NOT NULL DEFAULT '{}',
  max_guests           INT NOT NULL DEFAULT 1,
  bedrooms             INT NOT NULL DEFAULT 1,
  is_available         BOOLEAN NOT NULL DEFAULT TRUE,
  rating_avg           DECIMAL(3,2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TRANSACTIONS (Pi payments) ───────────────────────────────
-- Used by /api/payments/complete and Pi SDK flows
CREATE TABLE transactions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id),
  counterpart_id UUID REFERENCES users(id),
  type           TEXT NOT NULL
                 CHECK (type IN (
                   'purchase','sale','referral_reward','game_reward',
                   'course_enrollment','stay_booking','escrow_release',
                   'platform_fee'
                 )),
  amount_pi      DECIMAL(18,7) NOT NULL,
  pi_payment_id  TEXT NOT NULL UNIQUE,
  reference_id   UUID,
  reference_type TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','completed','failed','refunded')),
  metadata       JSONB DEFAULT '{}'::jsonb,
  memo           TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user   ON transactions(user_id);
CREATE INDEX idx_transactions_pi_id  ON transactions(pi_payment_id);

CREATE TABLE referrals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES users(id),
  referred_id UUID NOT NULL REFERENCES users(id),
  reward_pi   DECIMAL(18,7) NOT NULL DEFAULT 0.5,
  reward_paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referred_id)
);

CREATE INDEX idx_referrals_referrer  ON referrals(referrer_id);

-- ── STATUS POSTS (Newsfeed status updates) ───────────────────
CREATE TABLE status_posts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_status_posts_user_id ON status_posts(user_id);
CREATE INDEX idx_status_posts_created_at ON status_posts(created_at DESC);

-- ── LIVE SESSIONS ───────────────────────────────────────────
CREATE TABLE live_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT,
  stream_url   TEXT,
  status       TEXT NOT NULL DEFAULT 'live'
                CHECK (status IN ('live', 'ended')),
  viewer_count INT NOT NULL DEFAULT 0,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_live_sessions_user ON live_sessions(user_id);
CREATE INDEX idx_live_sessions_status ON live_sessions(status);
CREATE INDEX idx_live_sessions_started ON live_sessions(started_at DESC);

-- ── REVIEWS ─────────────────────────────────────────────────
CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewer_id  UUID NOT NULL REFERENCES users(id),
  target_id    UUID NOT NULL,
  target_type  TEXT NOT NULL
               CHECK (target_type IN ('listing','gig','course','stay','user')),
  rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(reviewer_id, target_id, target_type)
);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE gigs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Public read untuk listings & gigs
CREATE POLICY "listings_public_read"  ON listings  FOR SELECT USING (status = 'active');
CREATE POLICY "gigs_public_read"      ON gigs      FOR SELECT USING (status = 'active');

-- Users boleh baca profile sendiri
CREATE POLICY "users_self_read" ON users FOR SELECT USING (true);

-- ── UPDATED_AT TRIGGER ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated        BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_listings_updated     BEFORE UPDATE ON listings     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_gigs_updated         BEFORE UPDATE ON gigs         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated       BEFORE UPDATE ON orders       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_courses_updated      BEFORE UPDATE ON courses      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_stays_updated        BEFORE UPDATE ON stays        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ADMIN CREDENTIALS ───────────────────────────────────────
CREATE TABLE admin_credentials (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
