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
    const allowed = ["display_name", "bio", "phone", "email", "address_line1", "address_line2", "city", "state", "postcode", "country"];
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const supabase = await createAdminClient();

    // Check if profile just became complete — award SC one time
    const { data: before } = await supabase
      .from("users")
      .select("phone, email, address_line1, city, postcode, country, display_name, profile_complete_rewarded")
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
    let scRewarded = false;
    if (before && !before.profile_complete_rewarded) {
      const merged = { ...before, ...updates };
      const requiredFields = ["display_name", "phone", "email", "address_line1", "city", "postcode", "country"];
      const allFilled = requiredFields.every(f => merged[f as keyof typeof merged]?.toString().trim());

      if (allFilled) {
        // Award 10 SC
        const SC_REWARD = 10;
        // Award SC
        try {
          const { error: rpcErr } = await supabase.rpc("increment_sc_balance", {
            p_user_id: payload.userId,
            p_amount:  SC_REWARD,
          });
          if (rpcErr) throw rpcErr;
        } catch {
          // Fallback — direct update
          const { data: u } = await supabase.from("users").select("balance").eq("id", payload.userId).single();
          await supabase.from("users").update({ balance: (u?.balance ?? 0) + SC_REWARD }).eq("id", payload.userId);
        }

        // Mark as rewarded so it only happens once
        await supabase.from("users")
          .update({ profile_complete_rewarded: true })
          .eq("id", payload.userId);

        // Record transaction
        try {
          await supabase.from("sc_transactions").insert({
            user_id:     payload.userId,
            type:        "earn",
            amount:      SC_REWARD,
            source:      "profile_complete",
            description: "Profile completion reward",
          });
        } catch {} // ignore if table doesn't exist yet

        scRewarded = true;
        console.log(`[Profile] SC reward ${SC_REWARD} awarded to ${payload.userId}`);
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
