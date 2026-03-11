// src/app/api/credits/buy/route.ts
// POST /api/credits/buy
// action: "credit" — called after usePiPayment onSuccess, credit SC to wallet

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
  pro:     1000,
  whale:   5000,
};

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { txid, pkg, sc, action } = await req.json();

  // Legacy approve/complete flow (keep for backward compat)
  if (action === "approve") return NextResponse.json({ success: true });
  if (action === "complete") {
    // redirect to credit
  }

  // Main flow: credit SC after payment completed
  if (action === "credit" || action === "complete") {
    if (!txid) return NextResponse.json({ success: false, error: "Missing txid" }, { status: 400 });

    // Double-credit protection via txid
    const { data: existing } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("ref_id", txid)
      .eq("activity", "buy_sc")
      .maybeSingle();

    if (existing) return NextResponse.json({ success: false, error: "Already processed" }, { status: 400 });

    const scAmount = sc ?? PACKAGES[pkg] ?? 0;
    if (!scAmount) return NextResponse.json({ success: false, error: "Invalid package" }, { status: 400 });

    // Ensure wallet exists
    await supabase.from("supapi_credits")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: wallet } = await supabase
      .from("supapi_credits")
      .select("balance, total_earned")
      .eq("user_id", userId)
      .single();

    if (!wallet) return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 500 });

    const newBalance = wallet.balance + scAmount;

    await supabase.from("supapi_credits")
      .update({
        balance:      newBalance,
        total_earned: wallet.total_earned + scAmount,
        updated_at:   new Date().toISOString(),
      })
      .eq("user_id", userId);

    await supabase.from("credit_transactions").insert({
      user_id:      userId,
      type:         "earn",
      activity:     "buy_sc",
      amount:       scAmount,
      balance_after: newBalance,
      ref_id:       txid,
      note:         `💎 Bought ${scAmount} SC with Pi`,
    });

    return NextResponse.json({ success: true, data: { sc: scAmount, newBalance } });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
