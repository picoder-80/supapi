// src/app/api/credits/earn/route.ts
// POST /api/credits/earn — award SC for one-time activities
// Body: { activity: 'complete_profile' | 'first_listing' | 'review' | 'watch_reels' }

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

const ACTIVITY_SC: Record<string, { amount: number; oneTime: boolean; label: string }> = {
  complete_profile: { amount: 100, oneTime: true,  label: "Complete profile" },
  first_listing:    { amount: 50,  oneTime: true,  label: "First listing" },
  review:           { amount: 20,  oneTime: false, label: "Leave a review" },
  watch_reels:      { amount: 10,  oneTime: false, label: "Watch 5 Reels" },
};

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { activity, refId } = await req.json();

  const def = ACTIVITY_SC[activity];
  if (!def) return NextResponse.json({ success: false, error: "Invalid activity" }, { status: 400 });

  // Check if one-time activity already claimed
  if (def.oneTime) {
    const { data: existing } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("activity", activity)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: "Already claimed" }, { status: 400 });
    }
  }

  // Ensure wallet exists
  await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: wallet } = await supabase
    .from("supapi_credits")
    .select("balance, total_earned")
    .eq("user_id", userId)
    .single();

  if (!wallet) return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 500 });

  const newBalance = wallet.balance + def.amount;

  await supabase
    .from("supapi_credits")
    .update({
      balance: newBalance,
      total_earned: wallet.total_earned + def.amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "earn",
    activity,
    amount: def.amount,
    balance_after: newBalance,
    ref_id: refId ?? null,
    note: def.label,
  });

  return NextResponse.json({
    success: true,
    data: {
      earned: def.amount,
      newBalance,
      message: `+${def.amount} SC — ${def.label}`,
    }
  });
}
