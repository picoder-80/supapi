-- Status posts for Newsfeed (status-only feed)
CREATE TABLE IF NOT EXISTS status_posts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_posts_user_id ON status_posts(user_id);
CREATE INDEX idx_status_posts_created_at ON status_posts(created_at DESC);

ALTER TABLE status_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read status posts
CREATE POLICY "status_posts_public_read" ON status_posts FOR SELECT USING (true);

-- Users can insert their own
CREATE POLICY "status_posts_insert_own" ON status_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own
CREATE POLICY "status_posts_delete_own" ON status_posts FOR DELETE USING (auth.uid() = user_id);
