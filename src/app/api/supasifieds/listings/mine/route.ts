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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId?: string; id?: string; sub?: string };
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch {
    return null;
  }
}

function normalizeStatusForUi(status: unknown): string {
  const raw = String(status ?? "");
  if (raw === "removed") return "deleted";
  return raw;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const archived = searchParams.get("archived") === "true" || searchParams.get("archived") === "1";

  try {
    let query = supabase
      .from("classified_listings")
      .select(
        "id, title, description, price_display, category, subcategory, category_deep, images, status, location, views, is_boosted, boost_tier, boost_expires_at, created_at, updated_at"
      )
      .eq("seller_id", userId)
      .order("created_at", { ascending: false });

    if (archived) {
      query = query.in("status", ["removed", "deleted"]);
    } else {
      query = query.neq("status", "deleted").neq("status", "removed");
    }

    if (status && !archived) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const listingIds = (data ?? []).map((row: { id: string }) => row.id);
    const spotlightMap = new Map<string, string>();
    if (listingIds.length) {
      const { data: spotRows } = await supabase
        .from("classified_spotlights")
        .select("listing_id, expires_at")
        .in("listing_id", listingIds)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false });
      for (const row of spotRows ?? []) {
        if (!spotlightMap.has(String(row.listing_id ?? ""))) {
          spotlightMap.set(String(row.listing_id ?? ""), String(row.expires_at ?? ""));
        }
      }
    }

    const normalized = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      status: archived ? String(row.status ?? "") : normalizeStatusForUi(row.status),
      spotlight_expires_at: spotlightMap.get(String(row.id ?? "")) ?? null,
    }));
    return NextResponse.json({ success: true, data: normalized });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
