-- ============================================================
-- Supapi add-ons setup (safe for existing database)
-- Run this when base schema already exists.
-- Includes:
--   1) SupaPets tables
--   2) AI assistant memory table
--   3) SupaScrow escrow tables
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- SupaPets MVP schema
-- ============================================================

create table if not exists public.supapets_pets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  pet_key text not null check (pet_key in (
    'fluffy','barky','hoppy','scaly','chirpy','slither','fins','horn','spot','pebble'
  )),
  pet_name text not null,
  special_trait text not null,
  hatch_hours integer not null check (hatch_hours > 0),
  hatch_cost_sc integer not null default 0 check (hatch_cost_sc >= 0),
  is_hatched boolean not null default false,
  hatch_ready_at timestamptz not null,
  hatched_at timestamptz,
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  stage text not null default 'egg' check (stage in ('egg','baby','teen','adult')),
  hunger integer not null default 60 check (hunger >= 0 and hunger <= 100),
  happiness integer not null default 60 check (happiness >= 0 and happiness <= 100),
  health integer not null default 60 check (health >= 0 and health <= 100),
  energy integer not null default 60 check (energy >= 0 and energy <= 100),
  last_feed_at timestamptz,
  last_play_at timestamptz,
  last_clean_at timestamptz,
  last_sleep_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supapets_pets_user on public.supapets_pets(user_id);
create index if not exists idx_supapets_pets_hatch on public.supapets_pets(user_id, is_hatched, hatch_ready_at);

create table if not exists public.supapets_actions (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid not null references public.supapets_pets(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('hatch','feed','play','clean','sleep','item_use')),
  reward_sc integer not null default 0,
  xp_gain integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_supapets_actions_pet on public.supapets_actions(pet_id, created_at desc);
create index if not exists idx_supapets_actions_user on public.supapets_actions(user_id, created_at desc);

alter table if exists public.supapets_actions drop constraint if exists supapets_actions_action_check;
alter table if exists public.supapets_actions
  add constraint supapets_actions_action_check
  check (action in ('hatch','feed','play','clean','sleep','item_use'));

create table if not exists public.supapets_inventory (
  user_id uuid not null references public.users(id) on delete cascade,
  item_key text not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

create index if not exists idx_supapets_inventory_user on public.supapets_inventory(user_id);

create table if not exists public.supapets_daily (
  user_id uuid primary key references public.users(id) on delete cascade,
  streak integer not null default 0 check (streak >= 0),
  last_claim_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.supapets_achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  achievement_key text not null,
  title text not null,
  reward_sc integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  unlocked_at timestamptz not null default now(),
  unique(user_id, achievement_key)
);

create index if not exists idx_supapets_achievements_user on public.supapets_achievements(user_id, unlocked_at desc);

create table if not exists public.supapets_minigame_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  plays_today integer not null default 0 check (plays_today >= 0),
  total_plays integer not null default 0 check (total_plays >= 0),
  daily_reward_sc integer not null default 0 check (daily_reward_sc >= 0),
  last_play_at timestamptz,
  last_reset_date date not null default current_date,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- AI assistant memory schema
-- ============================================================

create table if not exists public.ai_assistant_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null,
  mode text not null default 'assistant',
  question text not null,
  answer text not null,
  provider text not null default 'heuristic',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_assistant_memory_user_created
  on public.ai_assistant_memory(user_id, created_at desc);

create index if not exists idx_ai_assistant_memory_scope
  on public.ai_assistant_memory(user_id, platform, mode, created_at desc);

-- ============================================================
-- SupaScrow escrow schema
-- ============================================================

create table if not exists public.supascrow_deals (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references public.users(id) on delete restrict,
  seller_id uuid not null references public.users(id) on delete restrict,
  amount_pi decimal(18,7) not null check (amount_pi > 0),
  currency text not null default 'pi' check (currency in ('pi','sc')),
  title text not null,
  description text,
  terms text,
  status text not null default 'created'
    check (status in (
      'created','accepted','funded','shipped','delivered','released','disputed','refunded','cancelled'
    )),
  tracking_number text,
  tracking_carrier text,
  pi_payment_id text,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supascrow_deals_buyer_seller_diff check (buyer_id != seller_id)
);

create index if not exists idx_supascrow_deals_buyer on public.supascrow_deals(buyer_id, created_at desc);
create index if not exists idx_supascrow_deals_seller on public.supascrow_deals(seller_id, created_at desc);
create index if not exists idx_supascrow_deals_status on public.supascrow_deals(status);

create table if not exists public.supascrow_messages (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid not null references public.supascrow_deals(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_supascrow_messages_deal on public.supascrow_messages(deal_id, created_at asc);

create table if not exists public.supascrow_disputes (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid not null references public.supascrow_deals(id) on delete cascade unique,
  initiator_id uuid not null references public.users(id) on delete cascade,
  reason text,
  resolution text check (resolution in ('release_to_seller','refund_to_buyer','partial','pending',null)),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supascrow_disputes_deal on public.supascrow_disputes(deal_id);

alter table public.supascrow_disputes add column if not exists ai_decision text;
alter table public.supascrow_disputes add column if not exists ai_reasoning text;
alter table public.supascrow_disputes add column if not exists ai_confidence decimal(3,2);

alter table if exists public.supascrow_deals enable row level security;
alter table if exists public.supascrow_messages enable row level security;
alter table if exists public.supascrow_disputes enable row level security;
