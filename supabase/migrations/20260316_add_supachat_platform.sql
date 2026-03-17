-- SupaChat core schema

CREATE TABLE IF NOT EXISTS public.supachat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID REFERENCES public.users(id) ON DELETE CASCADE,
  participant_2 UUID REFERENCES public.users(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count_1 INT DEFAULT 0,
  unread_count_2 INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

CREATE TABLE IF NOT EXISTS public.supachat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.supachat_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supachat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  type TEXT DEFAULT 'public',
  entry_fee_pi NUMERIC DEFAULT 0,
  max_users INT DEFAULT 200,
  created_by UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT true,
  is_promoted BOOLEAN DEFAULT false,
  promoted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supachat_room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.supachat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supachat_room_members (
  room_id UUID REFERENCES public.supachat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.supachat_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.supachat_conversations(id),
  room_id UUID REFERENCES public.supachat_rooms(id),
  sender_id UUID REFERENCES public.users(id),
  receiver_id UUID REFERENCES public.users(id),
  gross_pi NUMERIC NOT NULL,
  commission_pct NUMERIC DEFAULT 2,
  commission_pi NUMERIC NOT NULL,
  net_pi NUMERIC NOT NULL,
  message_id UUID,
  status TEXT DEFAULT 'pending',
  pi_payment_id TEXT,
  idempotency_key TEXT,
  txid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supachat_rain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.supachat_rooms(id),
  host_id UUID REFERENCES public.users(id),
  total_pi NUMERIC NOT NULL,
  service_fee_pi NUMERIC DEFAULT 0.1,
  per_user_pi NUMERIC NOT NULL,
  recipient_count INT NOT NULL,
  status TEXT DEFAULT 'pending',
  pi_payment_id TEXT,
  txid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supachat_rain_recipients (
  rain_id UUID REFERENCES public.supachat_rain_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  amount_pi NUMERIC NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (rain_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.supachat_verified_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  amount_pi NUMERIC DEFAULT 5,
  pi_payment_id TEXT,
  txid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supachat_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.supachat_rooms(id),
  purchased_by UUID REFERENCES public.users(id),
  days INT NOT NULL,
  amount_pi NUMERIC NOT NULL,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  pi_payment_id TEXT,
  txid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supachat_room_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.supachat_rooms(id),
  user_id UUID REFERENCES public.users(id),
  entry_fee_pi NUMERIC NOT NULL,
  commission_pct NUMERIC DEFAULT 20,
  commission_pi NUMERIC NOT NULL,
  host_pi NUMERIC NOT NULL,
  pi_payment_id TEXT,
  txid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.supachat_sponsored_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.supachat_rooms(id),
  advertiser_id UUID REFERENCES public.users(id),
  content TEXT NOT NULL,
  listing_id UUID,
  amount_pi NUMERIC NOT NULL,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  interval_messages INT DEFAULT 50,
  pi_payment_id TEXT,
  txid TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supachat_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  source_id UUID,
  amount_pi NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  type TEXT DEFAULT 'general',
  is_read BOOLEAN DEFAULT false,
  dedupe_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supachat_msg_conversation_created
  ON public.supachat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supachat_room_msg_room_created
  ON public.supachat_room_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supachat_conv_last_message_at
  ON public.supachat_conversations(last_message_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supachat_transfer_idempotency
  ON public.supachat_transfers(sender_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

INSERT INTO public.supachat_rooms (name, slug, description, category)
VALUES
  ('🛍️ SupaMarket', 'supamarket', 'Buy and sell in SupaMarket', 'trading'),
  ('💼 SupaSkil', 'supaskil', 'Find freelancers and gigs', 'work'),
  ('🎮 Gaming', 'gaming', 'Gamers unite', 'gaming'),
  ('💰 Pi Talk', 'pi-talk', 'Everything Pi Network', 'crypto')
ON CONFLICT (slug) DO NOTHING;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.supachat_messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.supachat_room_messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.supachat_conversations;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
