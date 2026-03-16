-- Add last_seen for presence/online status (used by heartbeat + lastseen API)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
