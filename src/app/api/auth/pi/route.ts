// app/api/auth/pi/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { signToken } from "@/lib/auth/jwt";
import { generateReferralCode } from "@/lib/referral";
import { sendWelcomeEmail } from "@/lib/email";

const schema = z.object({
  authResult: z.object({
    accessToken: z.string().min(1),
    user: z.object({
      uid:      z.string().min(1),
      username: z.string().min(1),
    }),
  }),
  referralCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid auth payload" }, { status: 400 });
    }

    const { authResult, referralCode } = parsed.data;
    const { accessToken, user: piUser } = authResult;

    // Verify with Pi API
    const meRes = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) {
      return NextResponse.json({ success: false, error: "Invalid Pi token" }, { status: 401 });
    }

    const meData = await meRes.json();
    if (meData.uid !== piUser.uid) {
      return NextResponse.json({ success: false, error: "Token mismatch" }, { status: 401 });
    }

    const supabase = await createAdminClient();

    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("pi_uid", piUser.uid)
      .single();

    let user = existingUser;
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      let referrerId: string | null = null;

      if (referralCode) {
        const { data: referrer } = await supabase
          .from("users")
          .select("id")
          .eq("referral_code", referralCode)
          .single();
        referrerId = referrer?.id ?? null;
      }

      const newReferralCode = generateReferralCode(piUser.username);
      const { data: created, error } = await supabase
        .from("users")
        .insert({
          pi_uid:        piUser.uid,
          username:      piUser.username,
          display_name:  piUser.username,
          referral_code: newReferralCode,
          referred_by:   referrerId,
        })
        .select()
        .single();

      if (error || !created) {
        return NextResponse.json({ success: false, error: "Failed to create account" }, { status: 500 });
      }

      user = created;

      if (referrerId) {
        await supabase.from("referrals").insert({
          referrer_id: referrerId,
          referred_id: user.id,
          reward_pi:   0.5,
        });
      }

      if (user.email) {
        await sendWelcomeEmail(user.email, user.username);
      }
    }

    const token = signToken({
      userId:   user.id,
      piUid:    user.pi_uid,
      username: user.username,
      role:     user.role ?? "user",
    });

    // Return token in response body — client stores in localStorage
    return NextResponse.json({
      success: true,
      data:    { user, token, isNewUser },
      message: isNewUser ? "Account created successfully" : "Signed in successfully",
    });

  } catch (err) {
    console.error("[Auth] Error:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  return NextResponse.json({ success: true, message: "Signed out" });
}