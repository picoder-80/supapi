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
