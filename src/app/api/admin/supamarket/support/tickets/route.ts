import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = await createAdminClient();
    let query = supabase
      .from("support_tickets")
      .select("id, user_id, order_id, message, category, priority, ai_reply, ai_actions, status, created_at, updated_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) {
      // table may not exist yet in some environments
      if (String(error.message).toLowerCase().includes("does not exist")) {
        return NextResponse.json({ success: true, data: { tickets: [], total: 0 }, warning: "support_tickets table not found" });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { tickets: data ?? [], total: count ?? 0 } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
