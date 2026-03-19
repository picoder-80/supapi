// src/app/api/credits/gift/route.ts
// POST /api/credits/gift
// Send SC gift to another user (70% to creator, 30% platform)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { toUsername, giftId, sc, emoji, name } = await req.json();
  const normalizedToUsername = String(toUsername ?? "").trim().toLowerCase();
  const giftAmount = Number(sc);

  if (!normalizedToUsername || !Number.isFinite(giftAmount) || giftAmount < 1) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  // Find recipient
  const { data: recipient } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", normalizedToUsername)
    .single();

  if (!recipient) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  if (recipient.id === userId) return NextResponse.json({ success: false, error: "Cannot gift yourself" }, { status: 400 });

  // Check sender balance
  const [{ data: senderUser }, { data: senderWallet }] = await Promise.all([
    supabase.from("users").select("username").eq("id", userId).single(),
    supabase
    .from("supapi_credits")
    .select("balance, total_spent")
    .eq("user_id", userId)
    .single(),
  ]);

  if (!senderWallet || senderWallet.balance < giftAmount) {
    return NextResponse.json({ success: false, error: "Insufficient SC balance" }, { status: 400 });
  }

  // Calculate split: 70% creator, 30% platform (platform = just deducted, not credited)
  const creatorSc = Math.floor(giftAmount * 0.7);
  const senderOldBalance = Number(senderWallet.balance ?? 0);
  const senderOldSpent = Number(senderWallet.total_spent ?? 0);
  const senderNewBalance = senderOldBalance - giftAmount;

  // Ensure recipient wallet exists
  await supabase.from("supapi_credits").upsert({ user_id: recipient.id }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: recipientWallet } = await supabase
    .from("supapi_credits")
    .select("balance, total_earned")
    .eq("user_id", recipient.id)
    .single();

  const recipientNewBalance = (recipientWallet?.balance ?? 0) + creatorSc;

  // Optimistic debit guard to reduce race-condition double-spend.
  const { data: senderUpdated } = await supabase.from("supapi_credits")
    .update({
      balance: senderNewBalance,
      total_spent: senderOldSpent + giftAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("balance", senderOldBalance)
    .gte("balance", giftAmount)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (!senderUpdated?.user_id) {
    return NextResponse.json({ success: false, error: "Gift conflict. Please try again." }, { status: 409 });
  }

  const recipientOldBalance = Number(recipientWallet?.balance ?? 0);
  const recipientOldEarned = Number(recipientWallet?.total_earned ?? 0);

  // Credit to recipient (70%)
  const { data: recipientUpdated } = await supabase.from("supapi_credits")
    .update({
      balance: recipientOldBalance + creatorSc,
      total_earned: recipientOldEarned + creatorSc,
      updated_at: new Date().toISOString(),
    })
    .eq("balance", recipientOldBalance)
    .eq("user_id", recipient.id)
    .select("user_id")
    .maybeSingle();
  if (!recipientUpdated?.user_id) {
    await supabase.from("supapi_credits")
      .update({
        balance: senderOldBalance,
        total_spent: senderOldSpent,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return NextResponse.json({ success: false, error: "Gift failed. Please retry." }, { status: 500 });
  }

  const recipientNewBalance = recipientOldBalance + creatorSc;

  // Log sender transaction
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "gift_sent",
    activity: "gift",
    amount: -sc,
    balance_after: senderNewBalance,
    ref_user_id: recipient.id,
    note: `${emoji} Gift ${name} to @${recipient.username}`,
  });

  // Log recipient transaction
  await supabase.from("credit_transactions").insert({
    user_id: recipient.id,
    type: "gift_received",
    activity: "gift",
    amount: creatorSc,
    balance_after: recipientNewBalance,
    ref_user_id: userId,
    note: `${emoji} Received ${name} gift (70%) from @${senderUser?.username ?? "user"}`,
  });

  return NextResponse.json({
    success: true,
    data: {
      sent: giftAmount,
      creatorReceives: creatorSc,
      senderBalance: senderNewBalance,
    }
  });
}
