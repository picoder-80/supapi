// src/app/api/dashboard/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// GET — fetch full profile including verification fields
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const supabase = await createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, bio, kyc_status, wallet_address, wallet_verified, wallet_verified_at, kyc_self_declared, role, created_at, phone, email, address_line1, address_line2, city, state, postcode, country, last_seen")
      .eq("id", payload.userId)
      .single();

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// PATCH — update profile fields
export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const allowed = ["display_name", "bio", "phone", "email", "address_line1", "address_line2", "city", "state", "postcode", "country", "wallet_address"];
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const supabase = await createAdminClient();

    // Check if profile just became complete — award SC one time
    const { data: before } = await supabase
      .from("users")
      .select("phone, email, address_line1, city, postcode, country, display_name, wallet_address")
      .eq("id", payload.userId)
      .single();

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", payload.userId)
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // ── SC reward for completing profile (one time only) ──
    // Uses supapi_credits + credit_transactions (same as other rewards)
    let scRewarded = false;
    if (before) {
      const merged = { ...before, ...updates };
      const requiredFields = ["display_name", "phone", "email", "address_line1", "city", "postcode", "country", "wallet_address"];
      const allFilled = requiredFields.every(f => merged[f as keyof typeof merged]?.toString().trim());

      if (allFilled) {
        // Check if already claimed via credit_transactions
        const { data: existing } = await supabase
          .from("credit_transactions")
          .select("id")
          .eq("user_id", payload.userId)
          .eq("activity", "profile_complete")
          .limit(1)
          .maybeSingle();

        if (!existing) {
          const SC_REWARD = 10;
          await supabase.from("supapi_credits").upsert({ user_id: payload.userId }, { onConflict: "user_id", ignoreDuplicates: true });
          const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", payload.userId).single();
          const nextBalance = (wallet?.balance ?? 0) + SC_REWARD;
          await supabase.from("supapi_credits").update({
            balance: nextBalance,
            total_earned: (wallet?.total_earned ?? 0) + SC_REWARD,
            updated_at: new Date().toISOString(),
          }).eq("user_id", payload.userId);
          await supabase.from("credit_transactions").insert({
            user_id: payload.userId,
            type: "earn",
            activity: "profile_complete",
            amount: SC_REWARD,
            balance_after: nextBalance,
            note: "Profile completion reward",
          });
          scRewarded = true;
          console.log(`[Profile] SC reward ${SC_REWARD} awarded to ${payload.userId}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data,
      sc_rewarded: scRewarded,
      sc_amount: scRewarded ? 10 : 0,
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
