// src/app/api/credits/checkin/route.ts
// POST /api/credits/checkin — daily check-in, earn SC

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

const CHECKIN_SC = 10;
const STREAK_BONUS_SC = 50;
const STREAK_DAYS = 7;

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Ensure wallet exists
  await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: wallet, error: walletErr } = await supabase
    .from("supapi_credits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (walletErr || !wallet) return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 500 });

  const today = new Date().toISOString().split("T")[0];

  // Already checked in today
  if (wallet.last_checkin === today) {
    return NextResponse.json({ success: false, error: "Already checked in today" }, { status: 400 });
  }

  // Calculate streak
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const isConsecutive = wallet.last_checkin === yesterdayStr;
  const newStreak = isConsecutive ? (wallet.checkin_streak + 1) : 1;
  const streakBonus = newStreak % STREAK_DAYS === 0 ? STREAK_BONUS_SC : 0;
  const totalEarned = CHECKIN_SC + streakBonus;
  const newBalance = wallet.balance + totalEarned;

  // Update wallet
  await supabase
    .from("supapi_credits")
    .update({
      balance: newBalance,
      total_earned: wallet.total_earned + totalEarned,
      last_checkin: today,
      checkin_streak: newStreak,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // Log check-in transaction
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "earn",
    activity: "daily_checkin",
    amount: CHECKIN_SC,
    balance_after: wallet.balance + CHECKIN_SC,
    note: `Day ${newStreak} check-in`,
  });

  // Log streak bonus if applicable
  if (streakBonus > 0) {
    await supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "earn",
      activity: "streak_bonus",
      amount: STREAK_BONUS_SC,
      balance_after: newBalance,
      note: `${STREAK_DAYS}-day streak bonus! 🔥`,
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      earned: CHECKIN_SC,
      streakBonus,
      totalEarned,
      newBalance,
      streak: newStreak,
      message: streakBonus > 0
        ? `🔥 ${STREAK_DAYS}-day streak! +${totalEarned} SC`
        : `✅ Check-in! +${CHECKIN_SC} SC`,
    }
  });
}
