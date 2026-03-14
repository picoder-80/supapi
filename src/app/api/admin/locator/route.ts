import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

// GET /api/admin/locator?status=pending&category=food&counts=1
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.locator.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createAdminClient();

  const { searchParams } = new URL(req.url);

  // Return counts only
  if (searchParams.get("counts") === "1") {
    const [p, a, r] = await Promise.all([
      supabase.from("businesses").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("businesses").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("businesses").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    ]);
    return NextResponse.json({ success: true, data: {
      pending: p.count ?? 0,
      approved: a.count ?? 0,
      rejected: r.count ?? 0,
    }});
  }

  const status   = searchParams.get("status") ?? "pending";
  const category = searchParams.get("category");
  const q        = searchParams.get("q");

  let query = supabase
    .from("businesses")
    .select("*, owner:users(username, avatar_url)")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (category && category !== "all") query = query.eq("category", category);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

// PATCH /api/admin/locator — approve/reject/verify/unverify
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.locator.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createAdminClient();

  const { id, action } = await req.json();
  if (!id || !action) return NextResponse.json({ success: false, error: "Missing id or action" }, { status: 400 });

  const updates: Record<string, any> = {};
  if (action === "approve")  { updates.status = "approved"; }
  if (action === "reject")   { updates.status = "rejected"; }
  if (action === "verify")   { updates.verified = true; }
  if (action === "unverify") { updates.verified = false; }

  const { error } = await supabase.from("businesses").update(updates).eq("id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/admin/locator?id=xxx
export async function DELETE(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.locator.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createAdminClient();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("businesses").delete().eq("id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}