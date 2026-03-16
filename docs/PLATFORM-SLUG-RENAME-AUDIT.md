# Platform URL slug rename – advice & audit

## Advice before you proceed

### 1. **Risks and considerations**

- **External links & SEO**: Any shared links or bookmarks to `/market`, `/myspace`, etc. will 404 after the rename. **Recommendation:** Add redirects (see below) so old URLs redirect to new ones (301 or 302).
- **API consumers**: Scripts and cron jobs use paths like `/api/market/ai/health`, `/api/market/ai/dispute/cron-check`. After renaming to `/api/supamarket/...`, update `AI_HEALTH_URL`, `AI_CRON_URL`, and any scripts (e.g. `scripts/ai-cron-run.mjs`, `scripts/ai-health-check.mjs`, `scripts/market-e2e.mjs`). README and env examples should be updated too.
- **Admin panel**: Today you have `/admin/market` and `/admin/platforms/gigs`, etc. For consistency with the new public slugs, decide whether to rename:
  - **Option A:** Only public routes (`/market` → `/supamarket`). Admin stays `/admin/market`, `/admin/platforms/gigs`.
  - **Option B:** Align admin with new names: `/admin/market` → `/admin/supamarket`, `admin/platforms/gigs` → `admin/platforms/supaskil`, and rename `api/admin/market` → `api/admin/supamarket`.
  This audit assumes **Option B** (rename admin routes and API segments to match the new slugs) unless you prefer to keep admin paths as-is.
- **Database / config**: No evidence of stored URL slugs in DB for these routes; if you add “platform” or “slug” columns later, use the new slug values.

### 2. **Order of operations (recommended)**

- **Per platform:** Do one platform at a time (e.g. market → supamarket first). For each:
  1. Rename **app route folder**: `src/app/<old>` → `src/app/<new>` (e.g. `market` → `supamarket`), including all nested routes.
  2. Rename **API route folder(s)** if they exist: `src/app/api/<old>` → `src/app/api/<new>`, and `src/app/api/admin/<old>` → `src/app/api/admin/<new>` where applicable.
  3. **Find & replace** all references to the old path and API path in the repo (href, Link, redirect, router.push, fetch, config arrays).
  4. Run a quick smoke test (build + click-through) for that platform.
- **After all renames:** Add redirects (Next.js or Vercel) from old URLs to new, then run full regression (links, API scripts, admin).

### 3. **Redirects**

- **Next.js:** In `next.config.ts` add a `redirects` async function that maps:
  - `/market` → `/supamarket`, `/market/*` → `/supamarket/*`
  - Same for the other 12 slugs (and optionally `/admin/market` → `/admin/supamarket`, etc. if you chose Option B).
- **Vercel:** Alternatively (or in addition) use `vercel.json` `redirects` for the same mappings. Your current `vercel.json` is empty, so either place is fine.

### 4. **Which slugs have app/API routes today**

| Old path         | New path      | App route exists        | API route exists     | Admin route exists           |
|------------------|---------------|--------------------------|----------------------|------------------------------|
| `/market`        | `/supamarket` | ✅ `src/app/market`      | ✅ `api/market`, `api/admin/market` | ✅ `admin/market`     |
| `/gigs`          | `/supaskil`   | ❌ (nav only)            | ❌                   | ✅ `admin/platforms/gigs`   |
| `/stay`          | `/supastay`   | ❌ (nav only)            | ❌                   | ✅ `admin/platforms/stay`    |
| `/academy`       | `/supademy`   | ❌ (nav only)            | ❌                   | ✅ `admin/platforms/academy`  |
| `/arcade`        | `/supanova`   | ❌ (nav only)            | ❌                   | ✅ `admin/platforms/arcade`  |
| `/myspace`       | `/supaspace`  | ✅ `src/app/myspace`     | ✅ `api/myspace`     | ✅ `admin/platforms/myspace` |
| `/jobs`          | `/supahiro`   | ❌ (nav only)            | ❌                   | ✅ `admin/platforms/jobs`    |
| `/classifieds`  | `/supasifieds`| ❌ (nav only)            | ❌                   | ✅ `admin/platforms/classifieds` |
| `/bulkhub`       | `/supabulk`   | ✅ `src/app/bulkhub`     | ✅ `api/bulkhub`     | ❌ (not in sidebar)          |
| `/machina-market`| `/supaauto`   | ✅ `src/app/machina-market` | ✅ `api/machina-market` | ❌                          |
| `/domus`         | `/supadomus`  | ✅ `src/app/domus`       | ✅ `api/domus`       | ❌                            |
| `/endoro`        | `/supaendoro` | ✅ `src/app/endoro`      | ✅ `api/endoro`      | ❌                            |
| `/social-feeds`  | `/supafeeds`  | ✅ `src/app/social-feeds`| ❌                   | ❌                            |

For **gigs, stay, academy, arcade, jobs, classifieds** there is **no** top-level app or API folder; only nav/dashboard/about links and admin platform pages. So for those you will:
- Create **app route folders**: e.g. `src/app/supaskil`, `src/app/supastay`, … (can be a simple “Coming soon” or redirect page), **or** keep linking to the same placeholder and only change the path (e.g. `/supaskil`).
- Optionally rename **admin** folders: `admin/platforms/gigs` → `admin/platforms/supaskil`, etc., and update admin nav config.

---

## Detailed audit by slug

### 1. `/market` → `/supamarket`

**App route folder (rename):**

- `src/app/market` → `src/app/supamarket`
  - Nested: `[id]/`, `[id]/edit/`, `create/`, `my-listings/`, `orders/`, `orders/[id]/`

**API route folders (rename):**

- `src/app/api/market` → `src/app/api/supamarket` (entire tree: listings, orders, boost, dispute, ai, images, etc.)
- `src/app/api/admin/market` → `src/app/api/admin/supamarket` (stats, listings, orders, disputes, support, commission, etc.)

**Admin app route (rename if Option B):**

- `src/app/admin/market` → `src/app/admin/supamarket`

**References to update (path/API):**

- **Dashboard:** `src/app/dashboard/page.tsx` – QUICK_ACTIONS `/market/orders`, PLATFORMS `/market`; Link hrefs `/market/orders`, `/market/orders/${id}`.
- **TopBar:** `src/components/layout/TopBar.tsx` – `href: "/market"`.
- **BottomNav:** `src/components/layout/BottomNav.tsx` – `href: "/market"`.
- **Homepage:** `src/app/page.tsx` – `platformCategories` href `/market`; Link “Explore Now” `/market`, “Get Started” `/market`.
- **About:** `src/app/about/page.tsx` – platforms href `/market`; Link “Start Exploring” `/market`.
- **PublicPlatformFrame:** `src/components/layout/PublicPlatformFrame.tsx` – `PLATFORM_PREFIXES` `/market` → `/supamarket`.
- **Market app pages (after folder rename they live under supamarket):**
  - All internal links: `/market` → `/supamarket`, `/market/orders` → `/supamarket/orders`, `/market/create` → `/supamarket/create`, `/market/my-listings`, `/market/${id}`, `/market/${id}/edit`.
  - All fetch URLs: `/api/market/*` → `/api/supamarket/*`.
- **Files:**  
  `src/app/supamarket/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `create/page.tsx`, `my-listings/page.tsx`, `orders/page.tsx`, `orders/[id]/page.tsx`.
- **ListingGrid:** `src/components/listings/ListingGrid.tsx` – `href={\`/market/${l.id}\`}` → `/supamarket/${l.id}`.
- **Admin:**  
  `src/app/admin/platforms/marketplace/page.tsx` – links to `/admin/market` → `/admin/supamarket` (if Option B); `adminFetch("/api/admin/market/...")` → `api/admin/supamarket/...`.  
  `src/app/admin/supamarket/page.tsx` (after rename) – all `adminFetch("/api/admin/market/...")` → `api/admin/supamarket/...`.  
  `src/lib/admin/adminNavConfig.ts` – `href: "/admin/market#..."` → `"/admin/supamarket#..."`.  
  `src/lib/admin/nav-access.ts` – `prefix: "/admin/market"` → `"/admin/supamarket"`.
- **Admin users:** `src/app/admin/users/[id]/page.tsx` – Links `/market/${l.id}`, `/market/orders/${o.id}` → `/supamarket/...`.
- **Myspace listings:** `src/app/myspace/[username]/listings/page.tsx` – PLATFORMS href `(u) => \`/market?seller=${u}\`` and market category → `/supamarket?...`.
- **Scripts:**  
  `scripts/ai-cron-run.mjs` – default `AI_CRON_URL` path.  
  `scripts/ai-health-check.mjs` – default `AI_HEALTH_URL` path.  
  `scripts/market-e2e.mjs` – all `/api/market/*` and `/market/*` URLs.
- **Docs:** `README.md` – all `/api/market/...` and `/market/...` examples.
- **Comments/schema:** `supabase/setup-all.sql`, `supabase/schema.sql` – comments that mention `src/app/api/market` (optional to update).

**Note:** Imports from `@/lib/market/*` (e.g. `categories`, `countries`, `ai`) are **unchanged** – they are internal module paths, not URL slugs.

---

### 2. `/gigs` → `/supaskil`

**App route:** No `src/app/gigs`. Create `src/app/supaskil` (e.g. “Coming soon” page) or redirect.

**API:** No `api/gigs`.

**Admin (Option B):** Rename `src/app/admin/platforms/gigs` → `src/app/admin/platforms/supaskil`. Update admin nav href `/admin/platforms/gigs` → `/admin/platforms/supaskil`.

**References:**

- **TopBar:** `src/components/layout/TopBar.tsx` – `/gigs` → `/supaskil`.
- **BottomNav:** `src/components/layout/BottomNav.tsx` – `/gigs` → `/supaskil`.
- **Dashboard:** `src/app/dashboard/page.tsx` – PLATFORMS href `/gigs` → `/supaskil`.
- **Homepage:** `src/app/page.tsx` – `platformCategories` href `/gigs` → `/supaskil`.
- **About:** `src/app/about/page.tsx` – href `/gigs` → `/supaskil`.
- **PublicPlatformFrame:** `src/components/layout/PublicPlatformFrame.tsx` – `/gigs` → `/supaskil`.
- **Admin nav:** `src/lib/admin/adminNavConfig.ts` – GIGS href `/admin/platforms/gigs` → `/admin/platforms/supaskil` (if Option B).

---

### 3. `/stay` → `/supastay`

Same pattern as gigs: no app/API route. Create `src/app/supastay`; optionally rename `admin/platforms/stay` → `admin/platforms/supastay`.

**References:** TopBar, BottomNav, dashboard PLATFORMS, page.tsx, about/page.tsx, PublicPlatformFrame, adminNavConfig (STAY).

---

### 4. `/academy` → `/supademy`

Same pattern. Create `src/app/supademy`; optionally rename `admin/platforms/academy` → `admin/platforms/supademy`.

**References:** TopBar, BottomNav, dashboard PLATFORMS, page.tsx, about/page.tsx, PublicPlatformFrame, adminNavConfig (ACADEMY).

---

### 5. `/arcade` → `/supanova`

Same pattern. Create `src/app/supanova`; optionally rename `admin/platforms/arcade` → `admin/platforms/supanova`.

**References:** TopBar, BottomNav, dashboard PLATFORMS, page.tsx, about/page.tsx, PublicPlatformFrame, adminNavConfig (ARCADE).

---

### 6. `/myspace` → `/supaspace`

**App route folder (rename):**

- `src/app/myspace` → `src/app/supaspace`  
  Nested: `[username]/`, `[username]/followers`, `following`, `listings`, `reviews`, `referrals`, `pets`, etc.

**API route folder (rename):**

- `src/app/api/myspace` → `src/app/api/supaspace` (e.g. follow, follow-list, reviews, stats).

**Admin (Option B):** Rename `admin/platforms/myspace` → `admin/platforms/supaspace`; update admin nav.

**References:**

- TopBar, BottomNav, dashboard (QUICK_ACTIONS “SupaSpace”, PLATFORMS), page.tsx, about/page.tsx, PublicPlatformFrame, adminNavConfig (MYSPACE).
- All internal links in (renamed) supaspace app: e.g. `/myspace` → `/supaspace`, `/myspace/${username}`, `/myspace/${username}/followers`, etc.
- Any `fetch("/api/myspace/...")` → `fetch("/api/supaspace/...")`.
- **Cross-links:** `src/app/newsfeed/page.tsx`, `src/app/wallet/page.tsx`, `src/components/providers/PresenceProvider.tsx`, `src/app/reels/page.tsx`, `src/app/live/[id]/page.tsx`, `src/app/supa-saylo/page.tsx`, `src/app/supa-livvi/page.tsx`, `src/app/supapod/[id]/page.tsx` – any href or push to `/myspace` or `/myspace/...` → `/supaspace/...`.
- Myspace-specific: `src/app/myspace/page.tsx` (→ supaspace) links to `/social-feeds` (→ `/supafeeds` in next step).  
- `src/app/myspace/[username]/listings/page.tsx` – PLATFORMS already covered under market/machina; ensure `/supaspace/...` used after rename.

---

### 7. `/jobs` → `/supahiro`

No app/API route. Create `src/app/supahiro`; optionally rename `admin/platforms/jobs` → `admin/platforms/supahiro`.

**References:** TopBar, BottomNav, dashboard PLATFORMS, page.tsx, about/page.tsx, PublicPlatformFrame, adminNavConfig (JOBS).  
Myspace listings page has a “jobs” platform entry that links to market with a category; that stays as market (or supamarket) URL with a query; only the main “Jobs” nav goes to `/supahiro`.

---

### 8. `/classifieds` → `/supasifieds`

No app/API route. Create `src/app/supasifieds`; optionally rename `admin/platforms/classifieds` → `admin/platforms/supasifieds`.

**References:** TopBar, BottomNav, dashboard PLATFORMS, page.tsx, about/page.tsx, PublicPlatformFrame, adminNavConfig (CLASSIFIEDS).

---

### 9. `/bulkhub` → `/supabulk`

**App route folder (rename):** `src/app/bulkhub` → `src/app/supabulk`.

**API route folder (rename):** `src/app/api/bulkhub` → `src/app/api/supabulk` (rfq, products, etc.).

**References:** TopBar, BottomNav, dashboard PLATFORMS, page.tsx, about/page.tsx, PublicPlatformFrame; all internal links and fetch in bulkhub pages → `/supabulk`, `/api/supabulk/...`.

---

### 10. `/machina-market` → `/supaauto`

**App route folder (rename):** `src/app/machina-market` → `src/app/supaauto` (nested: `create/`, `[id]/`).

**API route folder (rename):** `src/app/api/machina-market` → `src/app/api/supaauto`.

**References:** TopBar, BottomNav, dashboard PLATFORMS, page.tsx, about/page.tsx, PublicPlatformFrame; `src/app/machina-market/page.tsx` (→ supaauto) – all hrefs and fetch; myspace listings PLATFORMS `href: (u) => \`/machina-market?seller=${u}\`` → `/supaauto?seller=...`.

---

### 11. `/domus` → `/supadomus`

**App route folder (rename):** `src/app/domus` → `src/app/supadomus`.

**API route folder (rename):** `src/app/api/domus` → `src/app/api/supadomus`.

**References:** TopBar, BottomNav, dashboard PLATFORMS, page.tsx, about/page.tsx, PublicPlatformFrame; internal links and fetch in domus pages.

---

### 12. `/endoro` → `/supaendoro`

**App route folder (rename):** `src/app/endoro` → `src/app/endoro` (no – rename to `src/app/supaendoro`).

**API route folder (rename):** `src/app/api/endoro` → `src/app/api/supaendoro`.

**References:** TopBar, BottomNav, dashboard PLATFORMS, page.tsx, about/page.tsx, PublicPlatformFrame; internal links and fetch in endoro pages.

---

### 13. `/social-feeds` → `/supafeeds`

**App route folder (rename):** `src/app/social-feeds` → `src/app/supafeeds`.

**API:** No dedicated `api/social-feeds` (feed may come from newsfeed or other API).

**References:** Dashboard QUICK_ACTIONS and any PLATFORMS; TopBar, BottomNav; page.tsx, about/page.tsx; PublicPlatformFrame; myspace (supaspace) page, newsfeed page, myspace [username] followers/following pages – all `href="/social-feeds"` or “SupaFeeds” → `/supafeeds`.

---

## Config / nav summary

| File | What to update |
|------|----------------|
| `src/app/dashboard/page.tsx` | QUICK_ACTIONS (market/orders, myspace, social-feeds), PLATFORMS (all 13 slugs). |
| `src/components/layout/TopBar.tsx` | `navLinks` – all hrefs for the 13 slugs. |
| `src/components/layout/BottomNav.tsx` | `SCROLL_ITEMS` – all hrefs for the 13 slugs. |
| `src/app/page.tsx` | `platformCategories` – every module href. |
| `src/app/about/page.tsx` | `platformCategories` – every platform href. |
| `src/components/layout/PublicPlatformFrame.tsx` | `PLATFORM_PREFIXES` – market, gigs, stay, academy, arcade, social-feeds, jobs, classifieds, myspace, bulkhub, machina-market, domus, endoro. |
| `src/lib/admin/adminNavConfig.ts` | MARKETPLACE, GIGS, ACADEMY, STAY, ARCADE, JOBS, CLASSIFIEDS, MYSPACE hrefs (and folder renames if Option B). |
| `src/lib/admin/nav-access.ts` | If you rename admin routes: prefix `/admin/market` → `/admin/supamarket`. |

---

## Redirects checklist (after renames)

Add one redirect per slug (and optionally admin):

- `/market` → `/supamarket`, `/market/*` → `/supamarket/*`
- `/gigs` → `/supaskil`, `/gigs/*` → `/supaskil/*`
- `/stay` → `/supastay`, `/stay/*` → `/supastay/*`
- `/academy` → `/supademy`, `/academy/*` → `/supademy/*`
- `/arcade` → `/supanova`, `/arcade/*` → `/supanova/*`
- `/myspace` → `/supaspace`, `/myspace/*` → `/supaspace/*`
- `/jobs` → `/supahiro`, `/jobs/*` → `/supahiro/*`
- `/classifieds` → `/supasifieds`, `/classifieds/*` → `/supasifieds/*`
- `/bulkhub` → `/supabulk`, `/bulkhub/*` → `/supabulk/*`
- `/machina-market` → `/supaauto`, `/machina-market/*` → `/supaauto/*`
- `/domus` → `/supadomus`, `/domus/*` → `/supadomus/*`
- `/endoro` → `/supaendoro`, `/endoro/*` → `/supaendoro/*`
- `/social-feeds` → `/supafeeds`, `/social-feeds/*` → `/supafeeds/*`

Optional (Option B): `/admin/market` → `/admin/supamarket`, `/admin/market/*` → `/admin/supamarket/*`, and same for other admin platform segments.

---

## Suggested execution order

1. **market → supamarket** (largest surface: app, api, admin, many refs).
2. **myspace → supaspace** (many cross-links).
3. **machina-market → supaauto**, **bulkhub → supabulk**, **domus → supadomus**, **endoro → supaendoro** (each has app + api).
4. **social-feeds → supafeeds** (app only, many hrefs).
5. **gigs → supaskil**, **stay → supastay**, **academy → supademy**, **arcade → supanova**, **jobs → supahiro**, **classifieds → supasifieds** (create app folders + update nav/admin).

Then add redirects and update scripts/README/env.
