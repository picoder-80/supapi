-- SupaChat Groups: user-created invite-based groups

CREATE TABLE IF NOT EXISTS public.supachat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT true,
  max_members INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supachat_group_members (
  group_id UUID REFERENCES public.supachat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.supachat_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.supachat_groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supachat_group_msg_group_created
  ON public.supachat_group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supachat_group_members_group
  ON public.supachat_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_supachat_group_members_user
  ON public.supachat_group_members(user_id);

-- Add group_id to moderation logs for group message moderation
ALTER TABLE public.supachat_moderation_logs
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.supachat_groups(id);
CREATE INDEX IF NOT EXISTS idx_supachat_moderation_logs_group_created
  ON public.supachat_moderation_logs(group_id, created_at DESC)
  WHERE group_id IS NOT NULL;

-- Realtime for group messages
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.supachat_group_messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
