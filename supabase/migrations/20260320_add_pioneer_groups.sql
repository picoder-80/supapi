-- Pioneer Pins (for map) - create if not exists
CREATE TABLE IF NOT EXISTS public.pioneer_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  precision TEXT DEFAULT 'district',
  status TEXT DEFAULT 'active',
  visible_to TEXT DEFAULT 'everyone',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pioneer Groups (Local Pi Chapters)
CREATE TABLE IF NOT EXISTS public.pioneer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  lat NUMERIC,
  lng NUMERIC,
  cover_emoji TEXT DEFAULT '🏘️',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT true,
  member_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add member_count if table already exists
ALTER TABLE public.pioneer_groups ADD COLUMN IF NOT EXISTS member_count INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.pioneer_group_members (
  group_id UUID REFERENCES public.pioneer_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pioneer_pins_user ON public.pioneer_pins(user_id);
CREATE INDEX IF NOT EXISTS idx_pioneer_groups_public ON public.pioneer_groups(is_public);
CREATE INDEX IF NOT EXISTS idx_pioneer_group_members_group ON public.pioneer_group_members(group_id);
