import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload?.userId) return NextResponse.json({ success: false }, { status: 401 });
    const supabase = await createAdminClient();

    const { data: sub } = await supabase
      .from("mind_subscriptions")
      .select("id, status")
      .eq("user_id", payload.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 });

    // Only flag for cancellation at period end — keep status active so user retains access
    if (!["active", "grace"].includes(sub.status)) {
      return NextResponse.json({ success: false, error: "No active subscription to cancel" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("mind_subscriptions")
      .update({ cancel_at_period_end: true, canceled_at: nowIso, updated_at: nowIso })
      .eq("id", sub.id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: "Subscription will cancel at period end. Access continues until then." });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
