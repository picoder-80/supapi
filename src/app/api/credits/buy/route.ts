// src/app/api/credits/buy/route.ts
// POST /api/credits/buy
// action: 'approve' — server approves Pi payment
// action: 'complete' — server completes + credits SC to wallet

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

const PACKAGES: Record<string, number> = {
  starter: 100,
  popular: 500,
  pro: 1000,
  whale: 5000,
};

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { paymentId, txid, action, pkg, sc } = await req.json();

  // Step 1 — Approve payment with Pi Platform
  if (action === "approve") {
    try {
      await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
        method: "POST",
        headers: { Authorization: `Key ${process.env.PI_API_KEY}` },
      });
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ success: false, error: "Approve failed" }, { status: 500 });
    }
  }

  // Step 2 — Complete payment + credit SC
  if (action === "complete") {
    // Prevent double-credit — check if paymentId already processed
    const { data: existing } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("ref_id", paymentId)
      .eq("activity", "buy_sc")
      .limit(1)
      .maybeSingle();

    if (existing) return NextResponse.json({ success: false, error: "Already processed" }, { status: 400 });

    // Complete on Pi Platform
    try {
      await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
        method: "POST",
        headers: { Authorization: `Key ${process.env.PI_API_KEY}` },
        body: JSON.stringify({ txid }),
      });
    } catch {
      return NextResponse.json({ success: false, error: "Pi complete failed" }, { status: 500 });
    }

    const scAmount = sc ?? PACKAGES[pkg] ?? 0;
    if (!scAmount) return NextResponse.json({ success: false, error: "Invalid package" }, { status: 400 });

    // Ensure wallet exists
    await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: wallet } = await supabase
      .from("supapi_credits")
      .select("balance, total_earned")
      .eq("user_id", userId)
      .single();

    if (!wallet) return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 500 });

    const newBalance = wallet.balance + scAmount;

    await supabase
      .from("supapi_credits")
      .update({
        balance: newBalance,
        total_earned: wallet.total_earned + scAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    await supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "earn",
      activity: "buy_sc",
      amount: scAmount,
      balance_after: newBalance,
      ref_id: paymentId,
      note: `Bought ${scAmount} SC with Pi`,
    });

    return NextResponse.json({
      success: true,
      data: { sc: scAmount, newBalance },
    });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
