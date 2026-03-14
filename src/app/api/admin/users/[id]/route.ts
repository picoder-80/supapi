import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const supabase = await createAdminClient();
  const [{ data: user }, { data: listings, count: lCount }, { data: orders, count: oCount }] = await Promise.all([
    supabase.from("users").select("*").eq("id", id).single(),
    supabase.from("listings").select("id,title,price_pi,status,created_at", { count: "exact" }).eq("seller_id", id).neq("status","removed").limit(10),
    supabase.from("orders").select("id,status,amount_pi,created_at", { count: "exact" }).or(`buyer_id.eq.${id},seller_id.eq.${id}`).limit(10),
  ]);

  if (!user) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: { user, listings: listings ?? [], listing_count: lCount ?? 0, orders: orders ?? [], order_count: oCount ?? 0 } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const body = await req.json();
  const supabase = await createAdminClient();
  const updates: Record<string,unknown> = {};

  // Ban / unban
  if ("is_banned" in body) {
    updates.is_banned  = body.is_banned;
    updates.ban_reason = body.ban_reason ?? null;
    updates.banned_at  = body.is_banned ? new Date().toISOString() : null;
    updates.banned_by  = body.is_banned ? auth.userId : null;
    // Suspend all their active listings if banned
    if (body.is_banned) {
      await supabase.from("listings").update({ status: "paused" }).eq("seller_id", id).eq("status","active");
    }
  }

  // Seller verified badge
  if ("seller_verified" in body) updates.seller_verified = body.seller_verified;

  // KYC manual override
  if ("kyc_status" in body) updates.kyc_status = body.kyc_status;

  const { data, error } = await supabase.from("users").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}