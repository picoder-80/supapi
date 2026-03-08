import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const supabase = await createAdminClient();
    const uid = payload.userId;

    const [ordersRes, referralsRes, earningsRes, txRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true })
        .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
      supabase.from("referrals").select("id", { count: "exact", head: true })
        .eq("referrer_id", uid),
      supabase.from("transactions").select("amount_pi")
        .eq("user_id", uid).eq("type", "sale").eq("status", "completed"),
      supabase.from("transactions").select("id, type, amount_pi, memo, status, created_at")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
    ]);

    const earned = (earningsRes.data ?? []).reduce((s: number, t: any) => s + Number(t.amount_pi), 0);

    return NextResponse.json({
      success: true,
      data: {
        orders:       ordersRes.count   ?? 0,
        referrals:    referralsRes.count ?? 0,
        earned:       earned.toFixed(2),
        transactions: txRes.data ?? [],
      }
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}