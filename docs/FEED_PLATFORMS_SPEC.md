# Feed Platforms Spec — Newsfeed, Reels, Live, SupaFeeds

## 1. Newsfeed (Status Posts)

| Feature | Status | Notes |
|---------|--------|-------|
| Create | ✅ | POST /api/newsfeed/status |
| Read | ✅ | GET /api/newsfeed/status |
| Edit | ❌→✅ | PATCH /api/newsfeed/status/[id] — owner only |
| Delete | ❌→✅ | DELETE /api/newsfeed/status/[id] — owner only |
| Like | ❌→✅ | POST /api/newsfeed/status/[id]/like |
| Unlike | ❌→✅ | DELETE /api/newsfeed/status/[id]/like |
| Comment | ❌→✅ | POST /api/newsfeed/status/[id]/comments |
| List comments | ❌→✅ | GET /api/newsfeed/status/[id]/comments |
| Share | 🔜 | Future |

---

## 2. Reels (Short Videos)

| Feature | Status | Notes |
|---------|--------|-------|
| Create | ✅ | POST /api/reels |
| Upload | ✅ | POST /api/reels/upload |
| Caption | ✅ | Already in create form |
| Read | ✅ | GET /api/reels |
| Edit | ❌→✅ | PATCH /api/reels/[id] — caption only |
| Delete | ❌→✅ | DELETE /api/reels/[id] — owner only |
| Like | ❌→✅ | POST /api/reels/[id]/like |
| Unlike | ❌→✅ | DELETE /api/reels/[id]/like |
| Comment | ❌→✅ | POST /api/reels/[id]/comments |
| List comments | ❌→✅ | GET /api/reels/[id]/comments |
| View count | ❌→✅ | Increment on play (optional) |

---

## 3. Live (Live Streaming)

| Feature | Status | Notes |
|---------|--------|-------|
| Start | ✅ | POST /api/live |
| Read | ✅ | GET /api/live, GET /api/live/[id] |
| End | ❌→✅ | PATCH /api/live/[id] — owner only |
| Like | ❌→✅ | POST/DELETE /api/live/[id]/like |
| Comment | ❌→✅ | GET/POST /api/live/[id]/comments |
| Send gift | ❌→✅ | POST /api/live/[id]/gift — TikTok-style |
| Gift catalog | ❌→✅ | GET /api/live/gifts |
| Viewer count | ✅ | In schema |
| Live chat | 🔜 | Future |

---

## 4. SupaFeeds (Combined Feed)

| Feature | Status | Notes |
|---------|--------|-------|
| Combined feed | ✅ | GET /api/supafeeds |
| Status + Reels + Live | ✅ | Merged by time |
| All actions | Inherit | Uses same APIs as above |

---

## 5. Data Model

### Likes (status_post_likes, reel_likes)
- user_id, target_id, target_type ('status' | 'reel')
- UNIQUE(user_id, target_id)

### Comments (status_post_comments, reel_comments)
- Unified: feed_comments (target_type, target_id, user_id, body, created_at)

### Live Gifts
- live_gifts: id, live_session_id, sender_id, gift_id, gift_name, gift_emoji, amount_sc, created_at
- live_gift_catalog: id, name, emoji, amount_sc, sort_order

### Credits (existing)
- supapi_credits, credit_transactions
- Live gifts deduct from sender, 70% to host, 30% platform
