-- ============================================================
-- Supapi — One-shot setup (schema + SupaPets + AI memory)
-- Run this whole file in Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- Base schema (from supabase/schema.sql)
-- ============================================================

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

-- ============================================================
-- SupaPets MVP schema (from supabase/supapets.sql)
-- ============================================================

create table if not exists public.supapets_pets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  pet_key text not null check (pet_key in (
    'fluffy','barky','hoppy','scaly','chirpy','slither','fins','horn','spot','pebble'
  )),
  pet_name text not null,
  special_trait text not null,
  hatch_hours integer not null check (hatch_hours > 0),
  hatch_cost_sc integer not null default 0 check (hatch_cost_sc >= 0),
  is_hatched boolean not null default false,
  hatch_ready_at timestamptz not null,
  hatched_at timestamptz,
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  stage text not null default 'egg' check (stage in ('egg','baby','teen','adult')),
  hunger integer not null default 60 check (hunger >= 0 and hunger <= 100),
  happiness integer not null default 60 check (happiness >= 0 and happiness <= 100),
  health integer not null default 60 check (health >= 0 and health <= 100),
  energy integer not null default 60 check (energy >= 0 and energy <= 100),
  last_feed_at timestamptz,
  last_play_at timestamptz,
  last_clean_at timestamptz,
  last_sleep_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supapets_pets_user on public.supapets_pets(user_id);
create index if not exists idx_supapets_pets_hatch on public.supapets_pets(user_id, is_hatched, hatch_ready_at);

create table if not exists public.supapets_actions (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid not null references public.supapets_pets(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('hatch','feed','play','clean','sleep')),
  reward_sc integer not null default 0,
  xp_gain integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_supapets_actions_pet on public.supapets_actions(pet_id, created_at desc);
create index if not exists idx_supapets_actions_user on public.supapets_actions(user_id, created_at desc);

alter table if exists public.supapets_actions drop constraint if exists supapets_actions_action_check;
alter table if exists public.supapets_actions
  add constraint supapets_actions_action_check
  check (action in ('hatch','feed','play','clean','sleep','item_use'));

create table if not exists public.supapets_inventory (
  user_id uuid not null references public.users(id) on delete cascade,
  item_key text not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

create index if not exists idx_supapets_inventory_user on public.supapets_inventory(user_id);

create table if not exists public.supapets_daily (
  user_id uuid primary key references public.users(id) on delete cascade,
  streak integer not null default 0 check (streak >= 0),
  last_claim_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.supapets_achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  achievement_key text not null,
  title text not null,
  reward_sc integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  unlocked_at timestamptz not null default now(),
  unique(user_id, achievement_key)
);

create index if not exists idx_supapets_achievements_user on public.supapets_achievements(user_id, unlocked_at desc);

create table if not exists public.supapets_minigame_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  plays_today integer not null default 0 check (plays_today >= 0),
  total_plays integer not null default 0 check (total_plays >= 0),
  daily_reward_sc integer not null default 0 check (daily_reward_sc >= 0),
  last_play_at timestamptz,
  last_reset_date date not null default current_date,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- AI assistant memory schema (from supabase/ai-assistant-memory.sql)
-- ============================================================

create table if not exists public.ai_assistant_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null,
  mode text not null default 'assistant',
  question text not null,
  answer text not null,
  provider text not null default 'heuristic',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_assistant_memory_user_created
  on public.ai_assistant_memory(user_id, created_at desc);

create index if not exists idx_ai_assistant_memory_scope
  on public.ai_assistant_memory(user_id, platform, mode, created_at desc);
