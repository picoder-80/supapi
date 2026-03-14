import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.users.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q       = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim();
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page    = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
  const filter  = (searchParams.get("filter") ?? "").trim(); // banned | sellers
  const role    = (searchParams.get("role") ?? "").trim();
  const kyc     = (searchParams.get("kyc") ?? "").trim();
  const limitRaw = Number(searchParams.get("limit") ?? "20");
  const limit    = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 20;

  const supabase = await createAdminClient();
  let query = supabase
    .from("users")
    .select("id, username, display_name, avatar_url, email, kyc_status, role, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page-1)*limit, page*limit - 1);

  if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`);
  if (filter === "banned") query = query.eq("role", "banned");
  if (filter === "sellers") query = query.eq("role", "seller");
  if (role) {
    if (role === "banned") query = query.eq("role", "banned");
    else if (role === "kyc_pioneer") query = query.eq("role", "pioneer").eq("kyc_status", "verified");
    else query = query.eq("role", role);
  }
  if (kyc) query = query.eq("kyc_status", kyc);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const { data: roleRows, error: roleErr } = await supabase
    .from("users")
    .select("role")
    .limit(5000);
  if (roleErr) return NextResponse.json({ success: false, error: roleErr.message }, { status: 500 });

  const availableRoles = [...new Set((roleRows ?? []).map((r: any) => String(r.role ?? "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  return NextResponse.json({
    success: true,
    data: {
      users: data ?? [],
      data: data ?? [], // backward-compatible shape for legacy consumers
      available_roles: availableRoles,
      total: count ?? 0,
      page,
      limit,
    },
  });
}