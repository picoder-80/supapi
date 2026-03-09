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
  pi_balance_pending DECIMAL(18,7) NOT NULL DEFAULT 0,
  referral_code   TEXT UNIQUE NOT NULL,
  referred_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── LISTINGS (Classified) ───────────────────────────────────
CREATE TABLE listings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  price_pi    DECIMAL(18,7) NOT NULL,
  category    TEXT NOT NULL
              CHECK (category IN ('electronics','fashion','home','vehicles','services','digital','food','other')),
  images      TEXT[] NOT NULL DEFAULT '{}',
  location    TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','sold','pending','removed')),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  views_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- ── ORDERS (Gig orders) ─────────────────────────────────────
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id          UUID NOT NULL REFERENCES gigs(id),
  buyer_id        UUID NOT NULL REFERENCES users(id),
  seller_id       UUID NOT NULL REFERENCES users(id),
  package_index   INT NOT NULL DEFAULT 0,
  price_pi        DECIMAL(18,7) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','in_progress','delivered','completed','disputed','cancelled')),
  requirements    TEXT,
  delivery_url    TEXT,
  pi_payment_id   TEXT,
  escrow_released BOOLEAN NOT NULL DEFAULT FALSE,
  due_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- ── TRANSACTIONS ────────────────────────────────────────────
CREATE TABLE transactions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id),
  counterpart_id UUID REFERENCES users(id),
  type           TEXT NOT NULL
                 CHECK (type IN ('purchase','sale','referral_reward','game_reward','course_enrollment','stay_booking','escrow_release','platform_fee')),
  amount_pi      DECIMAL(18,7) NOT NULL,
  pi_payment_id  TEXT NOT NULL,
  reference_id   UUID,
  reference_type TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','completed','failed','refunded')),
  memo           TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── REFERRALS ───────────────────────────────────────────────
CREATE TABLE referrals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES users(id),
  referred_id UUID NOT NULL REFERENCES users(id),
  reward_pi   DECIMAL(18,7) NOT NULL DEFAULT 0.5,
  reward_paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referred_id)
);

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

-- ── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_listings_seller     ON listings(seller_id);
CREATE INDEX idx_listings_category   ON listings(category);
CREATE INDEX idx_listings_status     ON listings(status);
CREATE INDEX idx_gigs_seller         ON gigs(seller_id);
CREATE INDEX idx_gigs_category       ON gigs(category);
CREATE INDEX idx_orders_buyer        ON orders(buyer_id);
CREATE INDEX idx_orders_seller       ON orders(seller_id);
CREATE INDEX idx_transactions_user   ON transactions(user_id);
CREATE INDEX idx_transactions_pi_id  ON transactions(pi_payment_id);
CREATE INDEX idx_referrals_referrer  ON referrals(referrer_id);

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
