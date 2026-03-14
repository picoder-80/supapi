-- Supapi AI Assistant memory (server-side)
-- Run in Supabase SQL Editor.

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
