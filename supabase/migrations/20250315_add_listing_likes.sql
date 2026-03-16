-- Listing likes: who liked which listing; keep listings.likes count in sync

CREATE TABLE IF NOT EXISTS listing_likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_likes_listing ON listing_likes(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_likes_user ON listing_likes(user_id);

ALTER TABLE listing_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can read (to show counts); only authenticated can insert/delete own
CREATE POLICY "listing_likes_select" ON listing_likes FOR SELECT USING (true);
CREATE POLICY "listing_likes_insert_own" ON listing_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "listing_likes_delete_own" ON listing_likes FOR DELETE USING (auth.uid() = user_id);

-- Keep listings.likes in sync when like is added/removed
CREATE OR REPLACE FUNCTION sync_listing_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE listings SET likes = COALESCE(likes, 0) + 1 WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE listings SET likes = GREATEST(COALESCE(likes, 0) - 1, 0) WHERE id = OLD.listing_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_listing_likes_sync ON listing_likes;
CREATE TRIGGER trg_listing_likes_sync
  AFTER INSERT OR DELETE ON listing_likes
  FOR EACH ROW EXECUTE FUNCTION sync_listing_likes_count();
