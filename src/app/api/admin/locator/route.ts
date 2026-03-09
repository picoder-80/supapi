import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getAdmin(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return payload.role === "admin" ? payload : null;
  } catch { return null; }
}

// GET /api/admin/locator?status=pending&category=food&counts=1
export async function GET(req: Request) {
  if (!getAdmin(req)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
export async function PATCH(req: Request) {
  if (!getAdmin(req)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
export async function DELETE(req: Request) {
  if (!getAdmin(req)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("businesses").delete().eq("id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}