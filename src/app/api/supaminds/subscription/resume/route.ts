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
      .select("id, status, cancel_at_period_end, current_period_end")
      .eq("user_id", payload.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 });

    // Only allow resume if subscription is still within period
    const periodEndMs = new Date(String((sub as any).current_period_end ?? "")).getTime();
    const now = Date.now();
    const isPeriodValid = Number.isFinite(periodEndMs) && periodEndMs > now;

    if (!isPeriodValid) {
      return NextResponse.json({
        success: false,
        error: "Subscription period has ended. Please subscribe again to continue.",
      }, { status: 400 });
    }

    if (!["active", "grace", "canceled"].includes((sub as any).status)) {
      return NextResponse.json({
        success: false,
        error: "Subscription cannot be resumed in its current state.",
      }, { status: 400 });
    }

    const { error } = await supabase
      .from("mind_subscriptions")
      .update({ cancel_at_period_end: false, status: "active", canceled_at: null, updated_at: new Date().toISOString() })
      .eq("id", (sub as any).id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: "Auto-renewal resumed successfully." });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
