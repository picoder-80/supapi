// app/api/auth/pi/route.ts
// POST — Sign in with Pi Network

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyPiUser } from "@/lib/pi/payments";
import { signToken } from "@/lib/auth/jwt";
import { generateReferralCode } from "@/lib/referral";
import { sendWelcomeEmail } from "@/lib/email";
import * as R from "@/lib/api";

const schema = z.object({
  accessToken: z.string().min(1),
  referralCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return R.badRequest("Missing required fields");

    const { accessToken, referralCode } = parsed.data;

    // 1. Verify token with Pi API
    const piUser = await verifyPiUser(accessToken);
    if (!piUser) return R.unauthorized("Invalid Pi token");

    const supabase = await createAdminClient();

    // 2. Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("pi_uid", piUser.uid)
      .single();

    let user = existingUser;
    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      // 3. Find referrer if referral code provided
      let referrerId: string | null = null;
      if (referralCode) {
        const { data: referrer } = await supabase
          .from("users")
          .select("id")
          .eq("referral_code", referralCode)
          .single();
        referrerId = referrer?.id ?? null;
      }

      // 4. Create new user
      const newReferralCode = generateReferralCode(piUser.username);

      const { data: created, error } = await supabase
        .from("users")
        .insert({
          pi_uid: piUser.uid,
          username: piUser.username,
          display_name: piUser.username,
          referral_code: newReferralCode,
          referred_by: referrerId,
        })
        .select()
        .single();

      if (error || !created) {
        console.error("[Auth] Create user failed:", error);
        return R.serverError("Failed to create account");
      }

      user = created;

      // 5. Record referral
      if (referrerId) {
        await supabase.from("referrals").insert({
          referrer_id: referrerId,
          referred_id: user.id,
          reward_pi: 0.5,
        });
      }

      // 6. Send welcome email if available
      if (user.email) {
        await sendWelcomeEmail(user.email, user.username);
      }
    }

    // 7. Generate JWT
    const token = signToken({
      userId: user.id,
      piUid: user.pi_uid,
      username: user.username,
      role: user.role,
    });

    // 8. Set cookie
    const cookieStore = await cookies();
    cookieStore.set("supapi_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return R.ok(
      { user, isNewUser },
      isNewUser ? "Account created successfully" : "Signed in successfully"
    );
  } catch (err) {
    console.error("[Auth] Error:", err);
    return R.serverError();
  }
}

// DELETE — Sign out
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("supapi_token");
  return R.ok(null, "Signed out successfully");
}
