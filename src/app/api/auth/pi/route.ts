// app/api/auth/pi/route.ts
// POST — Sign in with Pi Network (following official Pi demo flow)

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { signToken } from "@/lib/auth/jwt";
import { generateReferralCode } from "@/lib/referral";
import { sendWelcomeEmail } from "@/lib/email";
import * as R from "@/lib/api";

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
      console.error("[Auth] Invalid payload:", parsed.error.errors);
      return R.badRequest("Invalid auth payload");
    }

    const { authResult, referralCode } = parsed.data;
    const { accessToken, user: piUser } = authResult;

    // 1. Verify accessToken with Pi Platform API GET /v2/me
    console.log("[Auth] Verifying token with Pi API...");
    const meRes = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!meRes.ok) {
      console.error("[Auth] Pi API verification failed:", meRes.status);
      return R.unauthorized("Invalid Pi token");
    }

    const meData = await meRes.json();
    console.log("[Auth] Pi API verified:", meData.username);

    // Confirm uid matches
    if (meData.uid !== piUser.uid) {
      return R.unauthorized("Token mismatch");
    }

    const supabase = await createAdminClient();

    // 2. Find or create user
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("pi_uid", piUser.uid)
      .single();

    let user = existingUser;
    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      // Find referrer
      let referrerId: string | null = null;
      if (referralCode) {
        const { data: referrer } = await supabase
          .from("users")
          .select("id")
          .eq("referral_code", referralCode)
          .single();
        referrerId = referrer?.id ?? null;
      }

      // Create user
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
        console.error("[Auth] Create user failed:", error);
        return R.serverError("Failed to create account");
      }

      user = created;

      // Record referral
      if (referrerId) {
        await supabase.from("referrals").insert({
          referrer_id: referrerId,
          referred_id: user.id,
          reward_pi:   0.5,
        });
      }

      // Welcome email
      if (user.email) {
        await sendWelcomeEmail(user.email, user.username);
      }
    }

    // 3. Issue JWT
    const token = signToken({
      userId:   user.id,
      piUid:    user.pi_uid,
      username: user.username,
      role:     user.role,
    });

    // 4. Set cookie
    const cookieStore = await cookies();
    cookieStore.set("supapi_token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7,
      path:     "/",
    });

    console.log("[Auth] Login success:", user.username, isNewUser ? "(new)" : "(existing)");

    return R.ok(
      { user, isNewUser },
      isNewUser ? "Account created successfully" : "Signed in successfully"
    );
  } catch (err) {
    console.error("[Auth] Unexpected error:", err);
    return R.serverError();
  }
}

// DELETE — Sign out
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("supapi_token");
  return R.ok(null, "Signed out successfully");
}