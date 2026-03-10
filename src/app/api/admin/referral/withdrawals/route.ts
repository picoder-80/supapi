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
    const p = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return p.role === "admin" ? p : null;
  } catch { return null; }
}

// GET — list all withdrawals with user info
export async function GET(req: Request) {
  if (!getAdmin(req)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
export async function PATCH(req: Request) {
  if (!getAdmin(req)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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