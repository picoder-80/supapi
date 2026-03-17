-- Like & Comment for Live sessions

-- Add like_count, comment_count to live_sessions
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0;

-- Live session likes
CREATE TABLE IF NOT EXISTS public.live_session_likes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, live_session_id)
);
CREATE INDEX IF NOT EXISTS idx_live_session_likes_session ON live_session_likes(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_likes_user ON live_session_likes(user_id);

-- Extend feed_comments to support live (drop old check, add new)
ALTER TABLE feed_comments DROP CONSTRAINT IF EXISTS feed_comments_target_type_check;
ALTER TABLE feed_comments ADD CONSTRAINT feed_comments_target_type_check
  CHECK (target_type IN ('status', 'reel', 'live'));

-- RLS for live_session_likes
ALTER TABLE live_session_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_session_likes_read" ON live_session_likes FOR SELECT USING (true);
CREATE POLICY "live_session_likes_insert" ON live_session_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "live_session_likes_delete" ON live_session_likes FOR DELETE USING (auth.uid() = user_id);
