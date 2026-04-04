// src/app/api/supamarket/listings/mine/route.ts
// GET — fetch current user's own listings (all statuses)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch { return null; }
}

function normalizeListingStatusForUi(status: unknown): string {
  const raw = String(status ?? "");
  if (raw === "removed") return "deleted";
  return raw;
}

function applyActiveBoostFallback<T extends { id?: string; is_boosted?: boolean | null; boost_tier?: string | null; boost_expires_at?: string | null }>(
  rows: T[],
  boostMap: Map<string, { tier: string | null; expires_at: string | null }>
): T[] {
  return rows.map((row) => {
    const id = String(row.id ?? "");
    if (!id) return row;
    const active = boostMap.get(id);
    if (!active) return row;
    return {
      ...row,
      is_boosted: true,
      boost_tier: active.tier ?? row.boost_tier ?? null,
      boost_expires_at: active.expires_at ?? row.boost_expires_at ?? null,
    };
  });
}

function applyPromotionExpirations(
  rows: Record<string, unknown>[],
  spotlightMap: Map<string, string>,
  carouselMap: Map<string, string>
): Record<string, unknown>[] {
  return rows.map((row) => {
    const id = String(row.id ?? "");
    if (!id) return row;
    const sp = spotlightMap.get(id);
    const cr = carouselMap.get(id);
    if (!sp && !cr) return row;
    return {
      ...row,
      ...(sp ? { spotlight_expires_at: sp } : {}),
      ...(cr ? { carousel_expires_at: cr } : {}),
    };
  });
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // optional filter
  const archived = searchParams.get("archived") === "true" || searchParams.get("archived") === "1";

  try {
    const fullSelect =
      "id, title, description, price_pi, category, subcategory, category_deep, condition, buying_method, images, stock, status, location, views, likes, is_boosted, boost_tier, boost_expires_at, created_at, updated_at";
    const compatSelect =
      "id, title, description, price_pi, category, subcategory, condition, buying_method, images, stock, status, location, views, likes, is_boosted, boost_tier, boost_expires_at, created_at, updated_at";
    const legacySelect =
      "id, title, description, price_pi, category, subcategory, condition, buying_method, images, stock, status, location, views, likes, created_at, updated_at";

    let query = supabase
      .from("listings")
      .select(fullSelect)
      .eq("seller_id", userId)
      .order("created_at", { ascending: false });

    if (archived) query = query.in("status", ["removed", "deleted"]);
    else query = query.neq("status", "deleted").neq("status", "removed");
    if (status && !archived) query = query.eq("status", status);

    const { data, error } = await query;
    let rows: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];
    if (error) {
      const mayBeSchemaMismatch =
        /column .* does not exist|schema cache/i.test(error.message ?? "");
      if (!mayBeSchemaMismatch) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      // Try compatibility query first (schema without category_deep but with boost columns).
      let compatQuery = supabase
        .from("listings")
        .select(compatSelect)
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
      if (archived) compatQuery = compatQuery.in("status", ["removed", "deleted"]);
      else compatQuery = compatQuery.neq("status", "deleted").neq("status", "removed");
      if (status && !archived) compatQuery = compatQuery.eq("status", status);
      const compatRes = await compatQuery;
      if (!compatRes.error) {
        rows = (compatRes.data ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          category_deep: "",
        }));
      } else {
        let legacyQuery = supabase
        .from("listings")
        .select(legacySelect)
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
        if (archived) legacyQuery = legacyQuery.in("status", ["removed", "deleted"]);
        else legacyQuery = legacyQuery.neq("status", "deleted").neq("status", "removed");
        if (status && !archived) legacyQuery = legacyQuery.eq("status", status);

        const legacyRes = await legacyQuery;
        if (legacyRes.error) {
          return NextResponse.json({ success: false, error: legacyRes.error.message }, { status: 500 });
        }
        rows = (legacyRes.data ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          category_deep: "",
          is_boosted: false,
          boost_tier: null,
          boost_expires_at: null,
        }));
      }
    }

    let resolvedRows = rows;
    try {
      const listingIds = resolvedRows.map((r) => String(r.id ?? "")).filter(Boolean);
      if (listingIds.length) {
        const { data: activeBoosts } = await supabase
          .from("listing_boosts")
          .select("listing_id, tier, expires_at, boosted_at")
          .in("listing_id", listingIds)
          .gt("expires_at", new Date().toISOString())
          .order("boosted_at", { ascending: false });

        if (activeBoosts?.length) {
          const boostMap = new Map<string, { tier: string | null; expires_at: string | null }>();
          for (const b of activeBoosts) {
            const key = String((b as any).listing_id ?? "");
            if (!key || boostMap.has(key)) continue;
            boostMap.set(key, {
              tier: (b as any).tier ?? null,
              expires_at: (b as any).expires_at ?? null,
            });
          }
          resolvedRows = applyActiveBoostFallback(resolvedRows as any[], boostMap) as typeof resolvedRows;
        }
      }
    } catch {
      // Best-effort fallback; ignore when listing_boosts table is unavailable.
    }

    try {
      const listingIds = resolvedRows.map((r) => String(r.id ?? "")).filter(Boolean);
      if (listingIds.length) {
        const nowIso = new Date().toISOString();

        let spotRes = await supabase
          .from("market_spotlights")
          .select("listing_id, expires_at, starts_at")
          .in("listing_id", listingIds)
          .eq("user_id", userId)
          .eq("is_active", true)
          .gt("expires_at", nowIso)
          .order("expires_at", { ascending: false });
        if (spotRes.error && /column|schema|does not exist/i.test(String(spotRes.error.message ?? ""))) {
          spotRes = await supabase
            .from("market_spotlights")
            .select("listing_id, expires_at, starts_at")
            .in("listing_id", listingIds)
            .eq("user_id", userId)
            .gt("expires_at", nowIso)
            .order("expires_at", { ascending: false });
        }

        const spotlightMap = new Map<string, string>();
        if (!spotRes.error && spotRes.data?.length) {
          for (const s of spotRes.data) {
            const row = s as { listing_id?: string; expires_at?: string };
            const key = String(row.listing_id ?? "");
            const ex = String(row.expires_at ?? "");
            if (!key || !ex || spotlightMap.has(key)) continue;
            spotlightMap.set(key, ex);
          }
        }

        let carRes = await supabase
          .from("market_carousel_ads")
          .select("listing_id, expires_at, starts_at")
          .in("listing_id", listingIds)
          .eq("user_id", userId)
          .eq("is_active", true)
          .gt("expires_at", nowIso)
          .order("expires_at", { ascending: false });
        if (carRes.error && /column|schema|does not exist/i.test(String(carRes.error.message ?? ""))) {
          carRes = await supabase
            .from("market_carousel_ads")
            .select("listing_id, expires_at, starts_at")
            .in("listing_id", listingIds)
            .eq("user_id", userId)
            .gt("expires_at", nowIso)
            .order("expires_at", { ascending: false });
        }

        const carouselMap = new Map<string, string>();
        if (!carRes.error && carRes.data?.length) {
          for (const c of carRes.data) {
            const row = c as { listing_id?: string | null; expires_at?: string };
            const key = row.listing_id != null ? String(row.listing_id) : "";
            const ex = String(row.expires_at ?? "");
            if (!key || !ex || carouselMap.has(key)) continue;
            carouselMap.set(key, ex);
          }
        }

        if (spotlightMap.size || carouselMap.size) {
          resolvedRows = applyPromotionExpirations(resolvedRows as Record<string, unknown>[], spotlightMap, carouselMap);
        }
      }
    } catch {
      // Best-effort; tables may be missing in older DBs.
    }

    const normalized = resolvedRows.map((row: Record<string, unknown>) => ({
      ...row,
      status: archived ? String(row.status ?? "") : normalizeListingStatusForUi(row.status),
    }));
    return NextResponse.json({ success: true, data: normalized });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
