import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "active";

    const supabase = await createAdminClient();
    let query = supabase
      .from("listings")
      .select("id, title, price_pi, images, category, status, stock, views, created_at")
      .eq("seller_id", payload.userId)
      .neq("status", "removed")
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}