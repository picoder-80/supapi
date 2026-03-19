// GET — search users with pi_uid for Treasury withdrawal recipient
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.treasury.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 50);

  const supabase = await createAdminClient();
  let query = supabase
    .from("users")
    .select("id, username, display_name, pi_uid")
    .not("pi_uid", "is", null)
    .order("username")
    .limit(20);

  if (q) {
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const recipients = (data ?? []).map((u: { id: string; username: string; display_name: string | null; pi_uid: string }) => ({
    id: u.id,
    username: u.username,
    display_name: u.display_name ?? u.username,
    pi_uid: String(u.pi_uid).trim(),
  }));

  return NextResponse.json({ success: true, data: recipients });
}
