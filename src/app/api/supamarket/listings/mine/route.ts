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

  try {
    let query = supabase
      .from("listings")
      .select("id, title, description, price_pi, category, subcategory, condition, buying_method, images, stock, status, location, views, likes, is_boosted, boost_tier, boost_expires_at, created_at, updated_at")
      .eq("seller_id", userId)
      .neq("status", "deleted")
      .neq("status", "removed")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const normalized = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      status: normalizeListingStatusForUi(row.status),
    }));
    return NextResponse.json({ success: true, data: normalized });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
