import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/security/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.users.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const [{ data: user }, { data: listings, count: lCount }, { data: orders, count: oCount }] = await Promise.all([
    supabase
      .from("users")
      .select("id, username, display_name, avatar_url, bio, email, phone, city, country, wallet_address, kyc_status, role, created_at")
      .eq("id", id)
      .single(),
    supabase.from("listings").select("id,title,price_pi,status,created_at", { count: "exact" }).eq("seller_id", id).neq("status","removed").limit(10),
    supabase.from("orders").select("id,status,amount_pi,created_at", { count: "exact" }).or(`buyer_id.eq.${id},seller_id.eq.${id}`).limit(10),
  ]);

  if (!user) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: { user, listings: listings ?? [], listing_count: lCount ?? 0, orders: orders ?? [], order_count: oCount ?? 0 } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const supabase = await createAdminClient();
  const updates: Record<string,unknown> = {};

  // Ban / unban mapped to role for current users schema
  if ("is_banned" in body) {
    if (!hasAdminPermission(auth.role, "admin.users.ban")) {
      return NextResponse.json({ success: false, error: "Forbidden: no ban permission" }, { status: 403 });
    }
    updates.role = body.is_banned ? "banned" : "pioneer";
    // Suspend all their active listings if banned
    if (body.is_banned) {
      await supabase.from("listings").update({ status: "paused" }).eq("seller_id", id).eq("status","active");
    }
    if (auth.userId) {
      await logAdminAction({
        adminUserId: auth.userId,
        action: body.is_banned ? "user_ban" : "user_unban",
        targetType: "user",
        targetId: id,
        detail: { via: "admin_user_detail" },
      });
    }
  }

  // Direct role update (optional use)
  if ("role" in body && typeof body.role === "string" && body.role.trim()) {
    if (!hasAdminPermission(auth.role, "admin.users.role_manage")) {
      return NextResponse.json({ success: false, error: "Forbidden: no role permission" }, { status: 403 });
    }
    updates.role = body.role.trim();
    if (auth.userId) {
      await logAdminAction({
        adminUserId: auth.userId,
        action: "user_role_change",
        targetType: "user",
        targetId: id,
        detail: { next_role: body.role.trim() },
      });
    }
  }

  // KYC is auto-managed from Pi auth sync; block manual admin override.
  if ("kyc_status" in body) {
    return NextResponse.json(
      { success: false, error: "KYC status is auto-managed by Pi verification sync" },
      { status: 400 }
    );
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: "No allowed fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select("id, username, display_name, avatar_url, bio, email, phone, city, country, wallet_address, kyc_status, role, created_at")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}