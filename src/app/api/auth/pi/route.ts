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
    }).passthrough(), // preserve KYC + extra fields Pi returns
  }).passthrough(),
  referralCode: z.string().optional(),
});

// Map Pi API KYC value → our enum
function mapKycStatus(piKyc: string | undefined): "unverified" | "pending" | "verified" {
  if (!piKyc) return "unverified";
  const v = piKyc.toLowerCase();
  // Pi API returns various strings — cover all known values
  if (["verified", "passed", "approved", "complete", "completed", "done", "true"].includes(v)) return "verified";
  if (["pending", "in_review", "inreview", "submitted", "processing"].includes(v)) return "pending";
  return "unverified";
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid auth payload" }, { status: 400 });
    }

    const { authResult, referralCode } = parsed.data;
    const { accessToken, user: piUser } = authResult;

    // ── Verify with Pi API ──────────────────────────────────
    const meRes = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) {
      return NextResponse.json({ success: false, error: "Invalid Pi token" }, { status: 401 });
    }

    const meData = await meRes.json();
    console.log("[Auth] Pi /me response:", JSON.stringify(meData));

    if (meData.uid !== piUser.uid) {
      return NextResponse.json({ success: false, error: "Token mismatch" }, { status: 401 });
    }

    // ── Extract KYC + wallet from Pi API response ───────────
    // Pi may return these in authResult.user, authResult, or meData — structure varies by Pi SDK version
    const authUser: any = parsed.data.authResult?.user ?? {};
    const authResultAny: any = authResult;

    // Deep search for KYC — check common paths
    const kycRaw =
      authUser.kyc_verified ?? authUser.kyc ?? authUser.kyc_status ?? authUser.credentials?.kyc ??
      authResultAny.user?.kyc_verified ?? authResultAny.user?.kyc ?? authResultAny.user?.kyc_status ??
      authResultAny.kyc_verified ?? authResultAny.kyc ?? authResultAny.kyc_status ?? authResultAny.credentials?.kyc ??
      meData?.credentials?.kyc ?? meData?.kyc_verified ?? meData?.kyc_status ?? meData?.kyc ??
      meData?.user?.kyc_verified ?? meData?.user?.kyc ?? meData?.user?.credentials?.kyc ??
      null;

    // Deep search for wallet_address — Pi may nest it differently
    const walletAddress =
      authUser.wallet_address ?? authUser.walletAddress ?? authUser.credentials?.wallet_address ??
      authResultAny.user?.wallet_address ?? authResultAny.user?.walletAddress ??
      authResultAny.wallet_address ?? authResultAny.walletAddress ?? authResultAny.credentials?.wallet_address ??
      meData?.wallet_address ?? meData?.walletAddress ?? meData?.credentials?.wallet_address ??
      meData?.user?.wallet_address ?? meData?.user?.credentials?.wallet_address ??
      null;

    const kycStatus = typeof kycRaw === "boolean"
      ? (kycRaw ? "verified" : "unverified")
      : mapKycStatus(kycRaw as string | undefined);

    // Log for debugging — Pi API structure can change
    console.log("[Auth] Pi response — authResult.user:", JSON.stringify(authUser));
    console.log("[Auth] Pi response — meData:", JSON.stringify(meData));
    console.log("[Auth] Extracted — kyc:", kycStatus, "wallet:", walletAddress ? `${walletAddress.slice(0, 12)}...` : "empty");

    const supabase = await createAdminClient();

    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("pi_uid", piUser.uid)
      .single();

    let user = existingUser;
    let isNewUser = false;

    if (!user) {
      // ── New user — create account ────────────────────────
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
          pi_uid:         piUser.uid,
          username:       piUser.username,
          display_name:   piUser.username,
          referral_code:  newReferralCode,
          referred_by:    referrerId,
          kyc_status:     kycStatus,
          wallet_address: walletAddress,
        })
        .select()
        .single();

      if (error || !created) {
        console.error("[Auth] Create user error:", error);
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

    } else {
      // ── Existing user — always persist KYC + wallet every login ──
      const kycRank: Record<string, number> = { unverified: 0, pending: 1, verified: 2 };
      const currentRank = kycRank[user.kyc_status] ?? 0;
      const newRank     = kycRank[kycStatus] ?? 0;
      // Only upgrade KYC — never downgrade (Pi API may return null even if verified)
      const effectiveKyc = newRank > currentRank ? kycStatus : (user.kyc_status ?? "unverified");
      if (newRank > currentRank) {
        console.log(`[Auth] KYC upgraded: ${user.kyc_status} → ${kycStatus}`);
      } else {
        console.log(`[Auth] KYC kept: ${user.kyc_status} (Pi returned: ${kycStatus})`);
      }

      const updates: Record<string, unknown> = {
        updated_at:  new Date().toISOString(),
        kyc_status:  effectiveKyc,
      };
      // Update wallet when Pi returns a value (never overwrite with null)
      if (walletAddress != null && walletAddress !== user.wallet_address) {
        updates.wallet_address = walletAddress;
        console.log(`[Auth] Wallet updated: ${walletAddress}`);
      }

      const { data: updated, error: updateError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) {
        console.error("[Auth] Supabase update user error:", updateError.message, updateError.details);
        return NextResponse.json(
          { success: false, error: "Failed to update profile" },
          { status: 500 }
        );
      }
      if (updated) user = updated;
    }

    // Always re-fetch user from DB so response has current kyc_status, wallet_address, etc.
    // (avoids stale object when Pi doesn't return KYC/wallet on re-login)
    const { data: freshUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();
    if (freshUser) user = freshUser;

    const token = signToken({
      userId:   user.id,
      piUid:    user.pi_uid,
      username: user.username,
      role:     user.role ?? "user",
    });

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