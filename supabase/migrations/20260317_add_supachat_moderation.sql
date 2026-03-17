CREATE TABLE IF NOT EXISTS supachat_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES supachat_rooms(id),
  conversation_id UUID REFERENCES supachat_conversations(id),
  message_content TEXT NOT NULL,
  violation_category TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  action_taken TEXT NOT NULL,
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supachat_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  violation_category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supachat_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE supachat_rooms ADD COLUMN IF NOT EXISTS moderation_enabled BOOLEAN DEFAULT true;
ALTER TABLE supachat_rooms ADD COLUMN IF NOT EXISTS moderation_sensitivity TEXT DEFAULT 'strict';

CREATE INDEX IF NOT EXISTS idx_supachat_moderation_logs_user_created
  ON supachat_moderation_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supachat_moderation_logs_room_created
  ON supachat_moderation_logs(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supachat_strikes_user_created
  ON supachat_strikes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supachat_sanctions_user_created
  ON supachat_sanctions(user_id, created_at DESC);
