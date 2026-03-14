-- SupaPets MVP schema
-- Run this in Supabase SQL Editor after main schema.

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
