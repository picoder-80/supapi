// /api/live/[id]/products — manage pinned products in live session
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// GET — fetch pinned products for session
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createAdminClient();

    const { data } = await supabase
      .from("live_pinned_products")
      .select(`
        id,
        listing_id,
        position,
        is_active,
        pinned_at,
        listing:listings!listing_id(
          id, title, price_pi, images, category, condition
        )
      `)
      .eq("session_id", id)
      .eq("is_active", true)
      .order("position", { ascending: true });

    return NextResponse.json({ success: true, data: { products: data ?? [] } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// POST — pin a product (host only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload?.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const listingId = String(body?.listing_id ?? "").trim();
    if (!listingId) return NextResponse.json({ success: false, error: "listing_id required" }, { status: 400 });

    const supabase = await createAdminClient();

    // Verify host owns this session
    const { data: session } = await supabase
      .from("live_sessions")
      .select("id, user_id, status")
      .eq("id", id)
      .eq("user_id", payload.userId)
      .maybeSingle();
    if (!session) return NextResponse.json({ success: false, error: "Session not found or not owner" }, { status: 403 });
    if (session.status !== "live") return NextResponse.json({ success: false, error: "Session not live" }, { status: 400 });

    // Verify listing belongs to host
    const { data: listing } = await supabase
      .from("listings")
      .select("id, title, price_pi, images")
      .eq("id", listingId)
      .eq("seller_id", payload.userId)
      .maybeSingle();
    if (!listing) return NextResponse.json({ success: false, error: "Listing not found or not yours" }, { status: 403 });

    // Max 5 pinned products at once
    const { count } = await supabase
      .from("live_pinned_products")
      .select("*", { count: "exact", head: true })
      .eq("session_id", id)
      .eq("is_active", true);

    if ((count ?? 0) >= 5) {
      return NextResponse.json({ success: false, error: "Max 5 pinned products per session" }, { status: 400 });
    }

    const { data: pinned, error } = await supabase
      .from("live_pinned_products")
      .upsert({
        session_id: id,
        listing_id: listingId,
        pinned_by: payload.userId,
        position: (count ?? 0) + 1,
        is_active: true,
      }, { onConflict: "session_id,listing_id" })
      .select("id, listing_id, position, is_active")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, data: { pinned, listing } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// DELETE — unpin a product (host only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload?.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const listingId = String(body?.listing_id ?? "").trim();

    const supabase = await createAdminClient();

    // Verify host
    const { data: session } = await supabase
      .from("live_sessions")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", payload.userId)
      .maybeSingle();
    if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    await supabase
      .from("live_pinned_products")
      .update({ is_active: false })
      .eq("session_id", id)
      .eq("listing_id", listingId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
