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

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // optional filter
  const archived = searchParams.get("archived") === "true" || searchParams.get("archived") === "1";

  try {
    const fullSelect =
      "id, title, description, price_pi, category, subcategory, category_deep, condition, buying_method, images, stock, status, location, views, likes, is_boosted, boost_tier, boost_expires_at, created_at, updated_at";
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

    let { data, error } = await query;
    if (error) {
      const mayBeSchemaMismatch =
        /column .* does not exist|schema cache/i.test(error.message ?? "");
      if (!mayBeSchemaMismatch) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

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
      data = (legacyRes.data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        category_deep: "",
        is_boosted: false,
        boost_tier: null,
        boost_expires_at: null,
      }));
    }

    const normalized = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      status: archived ? String(row.status ?? "") : normalizeListingStatusForUi(row.status),
    }));
    return NextResponse.json({ success: true, data: normalized });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
