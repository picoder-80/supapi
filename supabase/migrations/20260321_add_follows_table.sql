-- Follows table for SupaSpace / SupaFeeds / Newsfeed
-- Used by: /api/newsfeed, /api/myspace/follow, /api/reels, /api/live, etc.
CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Anyone can read follows (for follower counts, feed building)
DROP POLICY IF EXISTS "follows_public_read" ON follows;
CREATE POLICY "follows_public_read" ON follows FOR SELECT USING (true);

-- Users can insert their own follow (follower_id = self)
DROP POLICY IF EXISTS "follows_insert_own" ON follows;
CREATE POLICY "follows_insert_own" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can delete their own follow
DROP POLICY IF EXISTS "follows_delete_own" ON follows;
CREATE POLICY "follows_delete_own" ON follows FOR DELETE USING (auth.uid() = follower_id);
