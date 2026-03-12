// src/app/api/verify/wallet/init/route.ts
// POST — mark wallet verified using wallet_address already captured from Pi authenticate()
// No micro-transaction needed — Pi SDK returns wallet_address with "wallet_address" scope

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

  const { data: user } = await supabase
    .from("users")
    .select("wallet_address, wallet_verified")
    .eq("id", userId)
    .single();

  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  // Already verified
  if (user.wallet_verified) {
    return NextResponse.json({
      success:        true,
      already:        true,
      wallet_address: user.wallet_address,
    });
  }

  // wallet_address captured from Pi SDK — mark as verified instantly
  if (user.wallet_address) {
    await supabase
      .from("users")
      .update({
        wallet_verified:    true,
        wallet_verified_at: new Date().toISOString(),
      })
      .eq("id", userId);

    await supabase.from("kyc_verifications").upsert({
      user_id:        userId,
      proof_verified: true,
      proof_type:     "pi_auth",
      badge_level:    "wallet_verified",
      verified_at:    new Date().toISOString(),
    }, { onConflict: "user_id" });

    console.log(`[verify/wallet] ✅ userId=${userId} wallet=${user.wallet_address}`);

    return NextResponse.json({
      success:        true,
      verified:       true,
      wallet_address: user.wallet_address,
    });
  }

  // wallet_address not captured yet — user needs to re-login
  return NextResponse.json({
    success:      false,
    need_relogin: true,
    error:        "Wallet not found. Please sign out and sign in again.",
  });
}
