import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

// GET — list all withdrawals with user info
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.referral.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createAdminClient();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  const { data } = await supabase
    .from("referral_withdrawals")
    .select("id, amount_pi, pi_payment_id, pi_txid, status, note, created_at, updated_at, users(username, avatar_url)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ success: true, data: data ?? [] });
}

// PATCH — admin override: force complete, cancel, or add note
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.referral.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createAdminClient();

  const { id, action, note } = await req.json();
  if (!id || !action) return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });

  if (action === "force_complete") {
    await supabase.from("referral_withdrawals").update({ status: "completed", note, updated_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("referral_earnings").update({ status: "paid" }).eq("withdrawal_id", id);
    return NextResponse.json({ success: true });
  }

  if (action === "force_cancel") {
    await supabase.from("referral_earnings").update({ status: "pending", withdrawal_id: null }).eq("withdrawal_id", id);
    await supabase.from("referral_withdrawals").update({ status: "cancelled", note, updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ success: true });
  }

  if (action === "add_note") {
    await supabase.from("referral_withdrawals").update({ note }).eq("id", id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}