#!/usr/bin/env node
/**
 * Market E2E: Seller creates listing → Buyer creates order
 * 
 * Usage:
 *   node --env-file=.env.local scripts/market-e2e.mjs
 *   BASE_URL=http://localhost:3000 node --env-file=.env.local scripts/market-e2e.mjs
 * 
 * Requires: 2+ users in DB. Uses first 2 as seller & buyer.
 */

import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const BASE_URL = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function signToken(user) {
  return jwt.sign(
    { userId: user.id, piUid: user.pi_uid, username: user.username, role: user.role ?? "pioneer" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function api(method, path, token, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  if (!JWT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing JWT_SECRET, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get 2 users (seller & buyer must be different)
  const { data: users, error: ue } = await supabase
    .from("users")
    .select("id, username, pi_uid, role")
    .limit(10);

  if (ue || !users?.length) {
    console.error("No users in DB. Sign in via Pi first to create users.");
    process.exit(1);
  }

  let seller = users[0];
  let buyer = users.find((u) => u.id !== seller.id) ?? users[1];
  if (seller.id === buyer.id) {
    console.error("Need at least 2 different users. Only 1 user found.");
    process.exit(1);
  }

  const sellerToken = signToken(seller);
  const buyerToken = signToken(buyer);

  console.log("\n=== Market E2E: Seller + Buyer Flow ===\n");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Seller: @${seller.username} (${seller.id.slice(0, 8)}...)`);
  console.log(`Buyer:  @${buyer.username} (${buyer.id.slice(0, 8)}...)\n`);

  // ── 1. SELLER: Create listing ─────────────────────────────
  console.log("1. [SELLER] Creating listing...");
  const listingPayload = {
    title: "E2E Test Item — Wireless Mouse",
    description: "Brand new wireless mouse, 2.4GHz, ergonomic design. Test listing from E2E script.",
    price_pi: 5.5,
    category: "electronics",
    subcategory: "computers",
    condition: "new",
    buying_method: "both",
    location: "Kuala Lumpur",
    stock: 3,
    images: [],
    country_code: "MY",
    ship_worldwide: true,
  };

  const { ok: okList, data: listData } = await api("POST", "/api/supamarket/listings", sellerToken, listingPayload);
  if (!okList) {
    console.error("   FAIL:", listData?.error ?? listData);
    process.exit(1);
  }
  const listingId = listData.data?.id;
  console.log(`   OK — Listing created: ${listingId?.slice(0, 8)}...`);

  // ── 2. BUYER: Browse (optional) ───────────────────────────
  console.log("\n2. [BUYER] Browsing listings...");
  const browse = await fetch(`${BASE_URL}/api/supamarket/listings?page=1&sort=newest`);
  const browseData = await browse.json();
  if (browseData.success) {
    console.log(`   OK — ${browseData.data?.total ?? 0} listings found`);
  }

  // ── 3. BUYER: Create order (ship) ─────────────────────────
  console.log("\n3. [BUYER] Creating order (shipping)...");
  const orderPayload = {
    listing_id: listingId,
    buying_method: "ship",
    shipping_name: "Buyer Test",
    shipping_address: "123 Test Street",
    shipping_city: "Kuala Lumpur",
    shipping_postcode: "50000",
    shipping_country: "Malaysia",
    notes: "E2E test order",
  };

  const { ok: okOrder, data: orderData } = await api("POST", "/api/supamarket/orders", buyerToken, orderPayload);
  if (!okOrder) {
    console.error("   FAIL:", orderData?.error ?? orderData);
    process.exit(1);
  }
  const orderId = orderData.data?.id;
  console.log(`   OK — Order created: ${orderId?.slice(0, 8)}... (status: pending)`);

  // ── 4. BUYER: Fetch order detail ─────────────────────────
  console.log("\n4. [BUYER] Fetching order detail...");
  const { ok: okGet, data: getData } = await api("GET", `/api/supamarket/orders/${orderId}`, buyerToken);
  if (okGet) {
    const o = getData.data;
    console.log(`   OK — Order: ${o?.listing?.title ?? "—"} | ${o?.amount_pi} π`);
  }

  // ── 5. SANDBOX: Simulate payment complete (no Pi SDK) ─────
  // In real flow, Pi approve → complete creates escrow.
  // For E2E we skip Pi; order stays "pending".
  // Optional: use admin/simulate-complete if available.
  console.log("\n5. [NOTE] Pi payment skipped (E2E). Order remains 'pending'.");
  console.log("   In production: Buyer pays via Pi → approve → complete → escrow created.");

  console.log("\n=== E2E Complete ===\n");
  console.log("Summary:");
  console.log(`  Listing: ${BASE_URL}/supamarket/${listingId}`);
  console.log(`  Order:   ${BASE_URL}/supamarket/orders/${orderId}`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
