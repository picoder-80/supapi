-- ============================================================
-- SupaScrow — Escrow platform schema (Coinskro-style)
-- Flow: created → funded → shipped → delivered → released | disputed
-- ============================================================

create extension if not exists "uuid-ossp";

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
      'created',   -- deal created, awaiting seller accept
      'accepted',  -- seller accepted, awaiting buyer fund
      'funded',    -- buyer paid, funds in escrow
      'shipped',   -- seller shipped, tracking added
      'delivered', -- buyer confirmed delivery
      'released',  -- funds released to seller
      'disputed',  -- under dispute
      'refunded',  -- refunded to buyer
      'cancelled'  -- cancelled
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
  ai_decision text check (ai_decision in ('refund','release','manual_review',null)),
  ai_reasoning text,
  ai_confidence decimal(3,2) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supascrow_disputes_deal on public.supascrow_disputes(deal_id);

-- RLS: only backend (service_role) can access; anon/authenticated get no policies
alter table public.supascrow_deals enable row level security;
alter table public.supascrow_messages enable row level security;
alter table public.supascrow_disputes enable row level security;
