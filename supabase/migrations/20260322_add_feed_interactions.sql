-- Feed interactions: likes, comments, live gifts
-- Newsfeed + Reels + Live

-- Add like_count to status_posts (denormalized for feed)
ALTER TABLE status_posts ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;
ALTER TABLE status_posts ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0;

-- ── LIKES (status posts & reels) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.status_post_likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES status_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_status_post_likes_post ON status_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_status_post_likes_user ON status_post_likes(user_id);

CREATE TABLE IF NOT EXISTS public.reel_likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reel_id    UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, reel_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_likes_reel ON reel_likes(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_likes_user ON reel_likes(user_id);

-- ── COMMENTS (unified for status & reels) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feed_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type TEXT NOT NULL CHECK (target_type IN ('status', 'reel')),
  target_id   UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feed_comments_target ON feed_comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user ON feed_comments(user_id);

-- ── LIVE GIFT CATALOG (TikTok-style) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_gift_catalog (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  amount_sc  INT NOT NULL CHECK (amount_sc >= 1),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, amount_sc)
);

-- ── LIVE GIFT SEND ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_gifts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gift_id        UUID REFERENCES live_gift_catalog(id) ON DELETE SET NULL,
  gift_name      TEXT NOT NULL,
  gift_emoji     TEXT NOT NULL,
  amount_sc      INT NOT NULL CHECK (amount_sc >= 1),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_gifts_session ON live_gifts(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_gifts_sender ON live_gifts(sender_id);

-- ── UPDATE POLICY for status_posts (edit) ─────────────────────────────────
DROP POLICY IF EXISTS "status_posts_update_own" ON status_posts;
CREATE POLICY "status_posts_update_own" ON status_posts FOR UPDATE USING (auth.uid() = user_id);

-- ── RLS for new tables ────────────────────────────────────────────────────
ALTER TABLE status_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_gift_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_gifts ENABLE ROW LEVEL SECURITY;

-- Likes: anyone read, own insert/delete
CREATE POLICY "status_post_likes_read" ON status_post_likes FOR SELECT USING (true);
CREATE POLICY "status_post_likes_insert" ON status_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "status_post_likes_delete" ON status_post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "reel_likes_read" ON reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert" ON reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete" ON reel_likes FOR DELETE USING (auth.uid() = user_id);

-- Comments: anyone read, own insert/delete
CREATE POLICY "feed_comments_read" ON feed_comments FOR SELECT USING (true);
CREATE POLICY "feed_comments_insert" ON feed_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feed_comments_delete" ON feed_comments FOR DELETE USING (auth.uid() = user_id);

-- Gift catalog: public read
CREATE POLICY "live_gift_catalog_read" ON live_gift_catalog FOR SELECT USING (true);

-- Live gifts: anyone read, own insert
CREATE POLICY "live_gifts_read" ON live_gifts FOR SELECT USING (true);
CREATE POLICY "live_gifts_insert" ON live_gifts FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ── SEED DEFAULT GIFT CATALOG ─────────────────────────────────────────────
INSERT INTO live_gift_catalog (name, emoji, amount_sc, sort_order) VALUES
  ('Rose', '🌹', 1, 1),
  ('Heart', '❤️', 5, 2),
  ('Star', '⭐', 10, 3),
  ('Diamond', '💎', 50, 4),
  ('Rocket', '🚀', 100, 5),
  ('Crown', '👑', 500, 6)
ON CONFLICT (name, amount_sc) DO NOTHING;
