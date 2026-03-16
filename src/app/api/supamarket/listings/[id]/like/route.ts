import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

// POST — toggle like for listing (auth required)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: listingId } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Sign in to like" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const supabase = await createAdminClient();

    const { data: existing } = await supabase
      .from("listing_likes")
      .select("id")
      .eq("listing_id", listingId)
      .eq("user_id", payload.userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("listing_likes")
        .delete()
        .eq("listing_id", listingId)
        .eq("user_id", payload.userId);
      const { data: row } = await supabase
        .from("listings")
        .select("likes")
        .eq("id", listingId)
        .single();
      const likeCount = Math.max(0, Number(row?.likes ?? 0));
      return NextResponse.json({ success: true, data: { liked: false, like_count: likeCount } });
    }

    await supabase
      .from("listing_likes")
      .insert({ listing_id: listingId, user_id: payload.userId });
    const { data: row } = await supabase
      .from("listings")
      .select("likes")
      .eq("id", listingId)
      .single();
    const likeCount = Number(row?.likes ?? 0);
    return NextResponse.json({ success: true, data: { liked: true, like_count: likeCount } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
