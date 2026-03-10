// src/app/api/credits/route.ts
// GET  /api/credits        — get own balance + recent transactions
// POST /api/credits/checkin — daily check-in

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

// GET — fetch balance + last 20 transactions
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Ensure wallet exists
  await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: wallet } = await supabase
    .from("supapi_credits")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data: transactions } = await supabase
    .from("credit_transactions")
    .select(`
      *,
      ref_user:ref_user_id ( username, avatar_url )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Check if already checked in today
  const today = new Date().toISOString().split("T")[0];
  const canCheckin = !wallet?.last_checkin || wallet.last_checkin !== today;

  return NextResponse.json({
    success: true,
    data: {
      wallet,
      transactions: transactions ?? [],
      canCheckin,
    }
  });
}
