// POST /api/live/[id]/gift — send gift to live host (TikTok-style)
// Body: { gift_id?, amount_sc, name, emoji } — from catalog or custom

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = auth ? verifyToken(auth) : null;
    if (!payload?.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id: sessionId } = await params;
    if (!sessionId) return NextResponse.json({ success: false, error: "Missing session id" }, { status: 400 });

    const body = await req.json();
    const { gift_id, amount_sc, name, emoji } = body;
    const sc = Number(amount_sc) || 0;
    if (sc < 1) return NextResponse.json({ success: false, error: "amount_sc required (min 1)" }, { status: 400 });

    const supabase = await createAdminClient();

    const { data: session } = await supabase
      .from("live_sessions")
      .select("id, user_id, status")
      .eq("id", sessionId)
      .single();

    if (!session || session.status !== "live") {
      return NextResponse.json({ success: false, error: "Live session not found or ended" }, { status: 404 });
    }

    const hostId = session.user_id;
    if (hostId === payload.userId) {
      return NextResponse.json({ success: false, error: "Cannot gift yourself" }, { status: 400 });
    }

    const giftName = (name ?? "").toString().trim() || "Gift";
    const giftEmoji = (emoji ?? "").toString().trim() || "🎁";

    const { data: senderWallet } = await supabase
      .from("supapi_credits")
      .select("balance, total_spent")
      .eq("user_id", payload.userId)
      .single();

    if (!senderWallet || senderWallet.balance < sc) {
      return NextResponse.json({ success: false, error: "Insufficient SC balance" }, { status: 400 });
    }

    const creatorSc = Math.floor(sc * 0.7);
    const senderNewBalance = senderWallet.balance - sc;

    await supabase.from("supapi_credits").upsert(
      { user_id: hostId },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

    const { data: hostWallet } = await supabase
      .from("supapi_credits")
      .select("balance, total_earned")
      .eq("user_id", hostId)
      .single();

    const hostNewBalance = (hostWallet?.balance ?? 0) + creatorSc;

    await supabase.from("supapi_credits").update({
      balance: senderNewBalance,
      total_spent: senderWallet.total_spent + sc,
      updated_at: new Date().toISOString(),
    }).eq("user_id", payload.userId);

    await supabase.from("supapi_credits").update({
      balance: hostNewBalance,
      total_earned: (hostWallet?.total_earned ?? 0) + creatorSc,
      updated_at: new Date().toISOString(),
    }).eq("user_id", hostId);

    await supabase.from("live_gifts").insert({
      live_session_id: sessionId,
      sender_id: payload.userId,
      gift_id: gift_id || null,
      gift_name: giftName,
      gift_emoji: giftEmoji,
      amount_sc: sc,
    });

    const { data: hostUser } = await supabase.from("users").select("username").eq("id", hostId).single();
    const hostUsername = hostUser?.username ?? "?";

    await supabase.from("credit_transactions").insert({
      user_id: payload.userId,
      type: "gift_sent",
      activity: "live_gift",
      amount: -sc,
      balance_after: senderNewBalance,
      ref_user_id: hostId,
      note: `${giftEmoji} Live gift ${giftName} to @${hostUsername}`,
    });

    await supabase.from("credit_transactions").insert({
      user_id: hostId,
      type: "gift_received",
      activity: "live_gift",
      amount: creatorSc,
      balance_after: hostNewBalance,
      ref_user_id: payload.userId,
      note: `${giftEmoji} Received ${giftName} Live gift (70%)`,
    });

    return NextResponse.json({
      success: true,
      data: {
        sent: sc,
        creatorReceives: creatorSc,
        senderBalance: senderNewBalance,
      },
    });
  } catch (err) {
    console.error("[Live gift] error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
