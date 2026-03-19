// src/app/api/credits/transfer/route.ts
// POST /api/credits/transfer
// P2P SC transfer between users — 0% fee

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

  const { toUsername, amount } = await req.json();
  const normalizedToUsername = String(toUsername ?? "").trim().toLowerCase();
  const sc = parseInt(amount);

  if (!normalizedToUsername || !sc || sc < 1) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  if (sc > 10000) {
    return NextResponse.json({ success: false, error: "Max transfer is 10,000 SC per transaction" }, { status: 400 });
  }

  // Find recipient
  const { data: recipient } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", normalizedToUsername)
    .single();

  if (!recipient) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  if (recipient.id === userId) return NextResponse.json({ success: false, error: "Cannot transfer to yourself" }, { status: 400 });

  // Check sender balance + identity
  const [{ data: senderUser }, { data: senderWallet }] = await Promise.all([
    supabase.from("users").select("username").eq("id", userId).single(),
    supabase
    .from("supapi_credits")
    .select("balance, total_spent")
    .eq("user_id", userId)
    .single(),
  ]);

  if (!senderWallet || senderWallet.balance < sc) {
    return NextResponse.json({ success: false, error: "Insufficient SC balance" }, { status: 400 });
  }

  // Ensure recipient wallet exists
  await supabase.from("supapi_credits").upsert({ user_id: recipient.id }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: recipientWallet } = await supabase
    .from("supapi_credits")
    .select("balance, total_earned")
    .eq("user_id", recipient.id)
    .single();

  const senderOldBalance = Number(senderWallet.balance ?? 0);
  const senderOldSpent = Number(senderWallet.total_spent ?? 0);
  const senderNewBalance = senderOldBalance - sc;

  // Optimistic debit guard to reduce race-condition double-spend.
  const { data: senderUpdated } = await supabase.from("supapi_credits")
    .update({
      balance: senderNewBalance,
      total_spent: senderOldSpent + sc,
      updated_at: new Date().toISOString(),
    })
    .eq("balance", senderOldBalance)
    .gte("balance", sc)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (!senderUpdated?.user_id) {
    return NextResponse.json({ success: false, error: "Transfer conflict. Please try again." }, { status: 409 });
  }

  const recipientOldBalance = Number(recipientWallet?.balance ?? 0);
  const recipientOldEarned = Number(recipientWallet?.total_earned ?? 0);
  const recipientNewBalance = recipientOldBalance + sc;

  // Credit to recipient (100% — 0% fee)
  const { data: recipientUpdated } = await supabase.from("supapi_credits")
    .update({
      balance: recipientNewBalance,
      total_earned: recipientOldEarned + sc,
      updated_at: new Date().toISOString(),
    })
    .eq("balance", recipientOldBalance)
    .eq("user_id", recipient.id)
    .select("user_id")
    .maybeSingle();
  if (!recipientUpdated?.user_id) {
    // Best-effort compensation to avoid stuck debit if receiver update failed.
    await supabase.from("supapi_credits")
      .update({
        balance: senderOldBalance,
        total_spent: senderOldSpent,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return NextResponse.json({ success: false, error: "Transfer failed. Please retry." }, { status: 500 });
  }

  // Log sender
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "transfer_out",
    activity: "transfer",
    amount: -sc,
    balance_after: senderNewBalance,
    ref_user_id: recipient.id,
    note: `Transfer to @${recipient.username}`,
  });

  // Log recipient
  await supabase.from("credit_transactions").insert({
    user_id: recipient.id,
    type: "transfer_in",
    activity: "transfer",
    amount: sc,
    balance_after: recipientNewBalance,
    ref_user_id: userId,
    note: `Transfer from @${senderUser?.username ?? "user"}`,
  });

  return NextResponse.json({
    success: true,
    data: {
      transferred: sc,
      senderBalance: senderNewBalance,
    }
  });
}
