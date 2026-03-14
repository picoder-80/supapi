# π Supapi

> The Pi Network Super App — Marketplace, Gigs, Academy, Stay, Arcade & more.

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/supapi.git
cd supapi
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in all credentials:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_PI_APP_ID` | [develop.pi](https://develop.pi) |
| `PI_API_KEY` | [develop.pi](https://develop.pi) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API |
| `RESEND_API_KEY` | [resend.com](https://resend.com) |
| `JWT_SECRET` | Generate a random 32+ character string |

### 3. Setup Database (Supabase)

1. Go to [supabase.com](https://supabase.com) → New Project → name: `supapi`
2. Open **SQL Editor**
3. Copy and paste the contents of `supabase/schema.sql`
4. Click **Run**

### 4. Create First Admin

```bash
npx ts-node scripts/create-admin.ts
```

Then visit `/admin/login` with the credentials printed in the terminal.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> ⚠️ **Important**: Pi payment & auth must be tested inside **Pi Browser** with sandbox mode enabled.

---

## 🏗️ Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/pi/          # Pi authentication
│   │   ├── payments/         # approve & complete
│   │   ├── listings/         # Marketplace CRUD
│   │   ├── gigs/             # Gigs CRUD
│   │   └── admin/            # Admin API routes
│   ├── admin/                # Admin panel (protected)
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── listings/
│   │   ├── orders/
│   │   └── analytics/
│   ├── market/               # Marketplace pages
│   ├── gigs/                 # Gigs pages
│   ├── academy/              # Academy pages
│   ├── arcade/               # Arcade pages
│   ├── stay/                 # Stay pages
│   ├── wallet/               # Wallet pages
│   ├── referral/             # Referral pages
│   ├── community/            # Community pages
│   ├── layout.tsx            # Root layout (Pi SDK loads here)
│   └── page.tsx              # Homepage
├── components/
│   ├── admin/                # AdminShell, etc.
│   ├── auth/                 # LoginButton
│   ├── listings/             # ListingGrid
│   ├── layout/               # TopBar, BottomNav
│   └── providers/            # PiProvider, AuthProvider
├── hooks/
│   └── usePiPayment.ts       # Pi payment hook
├── lib/
│   ├── pi/                   # sdk.ts, payments.ts
│   ├── auth/                 # jwt.ts, session.ts
│   ├── supabase/             # client.ts, server.ts
│   ├── email.ts              # Resend email templates
│   ├── referral.ts           # Referral logic
│   └── api.ts                # API response helpers
├── middleware.ts              # Admin route protection
├── styles/
│   ├── globals.css            # CSS variables & reset
│   └── admin.css              # Admin shared styles
└── types/
    ├── index.ts               # Global TypeScript types
    └── pi.d.ts                # Pi SDK types
supabase/
└── schema.sql                 # Full database schema
scripts/
└── create-admin.ts            # Create first admin account
```

---

## 🔐 Pi SDK Flow

### Authentication
```
Pi Browser → Pi.authenticate() → /api/auth/pi → JWT cookie → User session
```

### Payment
```
User clicks Buy
  → Pi.createPayment()
  → onReadyForServerApproval → POST /api/payments/approve
  → User confirms in Pi Browser
  → onReadyForServerCompletion → POST /api/payments/complete
  → Update status & escrow
```

---

## 🚀 Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add all environment variables in Vercel Dashboard → Settings → Environment Variables.

---

## ⏱️ Scheduler Setup (Vercel + External Cron)

### 1) Required env vars

Add these in `.env.local` and Vercel project env:

- `CRON_SECRET` (long random secret)
- `INTERNAL_API_SECRET` (long random secret for internal-only earnings credit calls)
- `MARKET_AI_AUTO_RESOLVE_THRESHOLD` (example: `0.75`)
- `MARKET_AI_AGGRESSIVE_AUTO` (`true` / `false`)
- `MARKET_AI_MAX_AUTO_RESOLVE_PI` (example: `300`, high-value guardrail)
- `AI_ALERT_WEBHOOK_URL` (optional alert webhook for cron partial/failure)

### 2) Vercel Cron (already configured)

This repo includes `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/market/ai/dispute/cron-check?limit=25",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

After deploy, Vercel will call the cron endpoint every 10 minutes.

### 3) External cron (optional fallback)

You can also call manually with secret header:

```bash
curl -X POST "https://YOUR_DOMAIN/api/market/ai/dispute/cron-check?limit=25" \
  -H "x-cron-key: YOUR_CRON_SECRET"
```

Or bearer token:

```bash
curl -X POST "https://YOUR_DOMAIN/api/market/ai/dispute/cron-check?limit=25" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 4) Quick verify

```bash
curl "https://YOUR_DOMAIN/api/market/ai/dispute/cron-check?limit=5" \
  -H "x-cron-key: YOUR_CRON_SECRET"
```

Expected response shape:

```json
{
  "success": true,
  "data": {
    "processed": 0,
    "auto_resolved": 0,
    "still_open": 0,
    "failed": 0
  }
}
```

### Wallet automation security (`credit_earnings`)

`/api/wallet` action `credit_earnings` is protected for internal/admin use.

For internal automation service, include this header:

```bash
curl -X POST "https://YOUR_DOMAIN/api/wallet" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_OR_SYSTEM_JWT" \
  -H "x-internal-key: YOUR_INTERNAL_API_SECRET" \
  -d '{
    "action": "credit_earnings",
    "target_user_id": "USER_UUID_TO_CREDIT",
    "type": "referral_bonus",
    "source": "Referral Bonus",
    "amount_pi": 1.5,
    "status": "pending"
  }'
```

Set this env in local + production:

```env
INTERNAL_API_SECRET=YOUR_LONG_RANDOM_SECRET
```

### Admin-only simulate auto-credit test

Use this endpoint to verify "order completed -> auto-credit wallet" logic without waiting for full user flow:

```bash
# Dry run (no DB credit)
curl -X POST "https://YOUR_DOMAIN/api/admin/market/orders/ORDER_ID/simulate-complete" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"execute": false}'
```

```bash
# Execute real credit (one-time; returns 409 if already credited)
curl -X POST "https://YOUR_DOMAIN/api/admin/market/orders/ORDER_ID/simulate-complete" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"execute": true}'
```

### 5) AI health check (provider + fallback status)

Use this to confirm which provider is active at runtime:

```bash
curl "https://YOUR_DOMAIN/api/market/ai/health" \
  -H "x-cron-key: YOUR_CRON_SECRET"
```

Or from this repo:

```bash
AI_HEALTH_URL="https://YOUR_DOMAIN/api/market/ai/health" CRON_SECRET="YOUR_CRON_SECRET" npm run ai:health
```

Manual run cron-check from this repo:

```bash
AI_CRON_URL="https://YOUR_DOMAIN/api/market/ai/dispute/cron-check" AI_CRON_LIMIT=25 CRON_SECRET="YOUR_CRON_SECRET" npm run ai:cron:run
```

Run both checks in one command:

```bash
AI_HEALTH_URL="https://YOUR_DOMAIN/api/market/ai/health" \
AI_CRON_URL="https://YOUR_DOMAIN/api/market/ai/dispute/cron-check" \
AI_CRON_LIMIT=25 \
CRON_SECRET="YOUR_CRON_SECRET" \
npm run ai:ops:check
```

Expected response includes:

- `provider_order`
- `available` (which keys are set)
- `active_provider`
- `dispute_policy` (auto mode + threshold)

### 6) Ops readiness check

Use this endpoint to quickly validate critical runtime/security env health:

```bash
curl "https://YOUR_DOMAIN/api/ops/readiness" \
  -H "x-cron-key: YOUR_CRON_SECRET"
```

Response includes:

- `status`: `ready` | `warning` | `critical`
- `checks`: booleans for key env/security gates
- `failed`: list of failed checks

### 7) Optional DB table for AI job logs

Create this table to store each cron run (`success`, `partial_success`, `failed`):

```sql
create table if not exists public.ai_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  processed_count integer not null default 0,
  auto_resolved_count integer not null default 0,
  still_open_count integer not null default 0,
  failed_count integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_job_runs_job_name on public.ai_job_runs(job_name);
create index if not exists idx_ai_job_runs_created_at on public.ai_job_runs(created_at desc);
```

### 8) Optional DB table for admin audit logs

```sql
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_admin on public.admin_audit_logs(admin_user_id);
create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs(created_at desc);
```

---

## 📋 Pre-Launch Checklist

- [ ] Test all flows inside Pi Browser sandbox
- [ ] All `.env` variables filled in
- [ ] Run `supabase/schema.sql` in Supabase
- [ ] Verify Resend domain
- [ ] Test payment flow end-to-end
- [ ] Set `NEXT_PUBLIC_PI_SANDBOX=false` for production
- [ ] Setup custom domain in Vercel

---

*© 2025 Supapi. All rights reserved.*
