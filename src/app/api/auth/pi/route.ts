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

function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    if (["true", "1", "yes", "verified", "approved", "passed", "complete", "completed"].includes(v)) return true;
    if (["false", "0", "no", "unverified", "rejected", "failed"].includes(v)) return false;
  }
  return null;
}

/** Pi/Stellar-style public key (56 chars, G + 55 base32). */
function findStellarLikeAddressDeep(obj: unknown, depth = 0, maxDepth = 8): string | null {
  if (depth > maxDepth || obj == null) return null;
  if (typeof obj === "string") {
    const s = obj.trim();
    if (/^G[A-Z0-9]{55}$/.test(s)) return s;
    return null;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const w = findStellarLikeAddressDeep(x, depth + 1, maxDepth);
      if (w) return w;
    }
    return null;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === "accessToken") continue;
      const w = findStellarLikeAddressDeep(v, depth + 1, maxDepth);
      if (w) return w;
    }
  }
  return null;
}

/** Walk JSON for KYC flags Pi may nest under varying keys (SDK payload; /me is often minimal). */
function findKycVerifiedDeep(obj: unknown, depth = 0, maxDepth = 8): boolean | null {
  if (depth > maxDepth || obj == null) return null;
  if (typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === "accessToken") continue;
      const kl = k.toLowerCase();
      if (kl === "kycverified" || kl === "kyc_verified") {
        const b = parseBooleanLike(v);
        if (b !== null) return b;
      }
      if (kl === "kyc" && typeof v === "string") {
        const mapped = mapKycStatus(v);
        if (mapped === "verified") return true;
        if (mapped === "unverified") return false;
      }
      const inner = findKycVerifiedDeep(v, depth + 1, maxDepth);
      if (inner !== null) return inner;
    }
  } else if (Array.isArray(obj)) {
    for (const x of obj) {
      const inner = findKycVerifiedDeep(x, depth + 1, maxDepth);
      if (inner !== null) return inner;
    }
  }
  return null;
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

    const authTree: Record<string, unknown> = { ...(authResultAny as object as Record<string, unknown>) };
    delete authTree.accessToken;
    const combinedPiPayload = { authResult: authTree, me: meData };

    // Deep search for KYC — check common paths
    const kycRaw =
      authUser.kyc_verified ?? authUser.kyc ?? authUser.kyc_status ?? authUser.credentials?.kyc ??
      authResultAny.user?.kyc_verified ?? authResultAny.user?.kyc ?? authResultAny.user?.kyc_status ??
      authResultAny.kyc_verified ?? authResultAny.kyc ?? authResultAny.kyc_status ?? authResultAny.credentials?.kyc ??
      meData?.credentials?.kyc ?? meData?.kyc_verified ?? meData?.kyc_status ?? meData?.kyc ??
      meData?.user?.kyc_verified ?? meData?.user?.kyc ?? meData?.user?.credentials?.kyc ??
      null;

    const kycBooleanRaw =
      authUser.kycVerified ??
      authResultAny.user?.kycVerified ??
      authResultAny.kycVerified ??
      meData?.kycVerified ??
      meData?.user?.kycVerified ??
      null;

    // Deep search for wallet_address — Pi may nest it differently
    const walletExplicit =
      authUser.wallet_address ?? authUser.walletAddress ?? authUser.credentials?.wallet_address ??
      authUser.credentials?.walletAddress ??
      authResultAny.user?.wallet_address ?? authResultAny.user?.walletAddress ??
      authResultAny.user?.credentials?.wallet_address ?? authResultAny.user?.credentials?.walletAddress ??
      authResultAny.wallet_address ?? authResultAny.walletAddress ?? authResultAny.credentials?.wallet_address ??
      authResultAny.credentials?.walletAddress ??
      meData?.wallet_address ?? meData?.walletAddress ?? meData?.credentials?.wallet_address ??
      meData?.credentials?.walletAddress ??
      meData?.user?.wallet_address ?? meData?.user?.walletAddress ?? meData?.user?.credentials?.wallet_address ??
      meData?.user?.credentials?.walletAddress ??
      null;

    const walletFromDeep = findStellarLikeAddressDeep(combinedPiPayload);
    const walletTrim = typeof walletExplicit === "string" ? walletExplicit.trim() : "";
    const walletAddress = walletTrim || walletFromDeep || null;
    const walletSource: "explicit" | "deep" | "none" = walletTrim
      ? "explicit"
      : walletFromDeep
        ? "deep"
        : "none";

    const kycStatus = typeof kycRaw === "boolean"
      ? (kycRaw ? "verified" : "unverified")
      : mapKycStatus(kycRaw as string | undefined);
    const kycFromDeep = findKycVerifiedDeep(combinedPiPayload);
    const kycBoolean = parseBooleanLike(kycBooleanRaw) ?? kycFromDeep;
    const effectiveIncomingKyc = kycBoolean === true ? "verified" : (kycBoolean === false ? "unverified" : kycStatus);

    // Log for debugging — Pi API structure can change
    console.log("[Auth] Pi response — authResult.user:", JSON.stringify(authUser));
    console.log("[Auth] Pi response — meData:", JSON.stringify(meData));
    console.log("[Auth] Extracted — kyc:", effectiveIncomingKyc, "wallet:", walletAddress ? `${walletAddress.slice(0, 12)}...` : "empty");

    const credKeysForDebug =
      meData?.credentials && typeof meData.credentials === "object" && !Array.isArray(meData.credentials)
        ? Object.keys(meData.credentials as Record<string, unknown>)
        : [];

    const supabase = await createAdminClient();

    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("pi_uid", piUser.uid)
      .single();

    // #region agent log
    fetch("http://127.0.0.1:7583/ingest/85ab3f18-cb22-483f-9206-fdd2fd446d94", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2cdd1d" },
      body:    JSON.stringify({
        sessionId:    "2cdd1d",
        runId:        "pi-auth-1",
        hypothesisId: "A,B,C",
        location:     "api/auth/pi/route.ts:afterExistingLookup",
        message:      "Pi /me + authResult shape and extraction",
        data:         {
          meKeys:            Object.keys(meData || {}),
          credKeys:          credKeysForDebug,
          authUserKeys:      Object.keys(authUser || {}),
          authTopKeys:       Object.keys(authResultAny || {}).filter((k) => k !== "accessToken"),
          walletSource,
          walletLen:         walletAddress ? String(walletAddress).length : 0,
          effectiveIncomingKyc,
          kycRawKind:        kycRaw === null || kycRaw === undefined ? "nullish" : typeof kycRaw,
          kycBooleanRawKind: kycBooleanRaw === null || kycBooleanRaw === undefined ? "nullish" : typeof kycBooleanRaw,
          kycFromDeepVal:    kycFromDeep,
          isNewUser:         !existingUser,
          dbHadWallet:       !!(existingUser as { wallet_address?: string } | null)?.wallet_address,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

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
          kyc_status:     effectiveIncomingKyc,
          wallet_address: walletAddress,
          wallet_verified: !!walletAddress,
          wallet_verified_at: walletAddress ? new Date().toISOString() : null,
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
      const newRank     = kycRank[effectiveIncomingKyc] ?? 0;
      // Only upgrade KYC — never downgrade (Pi API may return null even if verified)
      const effectiveKyc = newRank > currentRank ? effectiveIncomingKyc : (user.kyc_status ?? "unverified");
      if (newRank > currentRank) {
        console.log(`[Auth] KYC upgraded: ${user.kyc_status} → ${effectiveIncomingKyc}`);
      } else {
        console.log(`[Auth] KYC kept: ${user.kyc_status} (Pi returned: ${effectiveIncomingKyc})`);
      }

      const updates: Record<string, unknown> = {
        updated_at:  new Date().toISOString(),
        kyc_status:  effectiveKyc,
      };
      // Update wallet when Pi returns a value (never overwrite with null)
      if (walletAddress != null && walletAddress !== user.wallet_address) {
        updates.wallet_address = walletAddress;
        updates.wallet_verified = true;
        updates.wallet_verified_at = new Date().toISOString();
        console.log(`[Auth] Wallet updated: ${walletAddress}`);
      } else if (walletAddress && !user.wallet_verified) {
        updates.wallet_verified = true;
        updates.wallet_verified_at = new Date().toISOString();
        console.log("[Auth] Wallet verification auto-enabled from Pi auth data");
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

    const authDebug =
      process.env.DEBUG_PI_AUTH === "true"
        ? {
            sessionId:            "2cdd1d",
            meKeys:               Object.keys(meData || {}),
            credKeys:             credKeysForDebug,
            authUserKeys:         Object.keys(authUser || {}),
            authTopKeys:          Object.keys(authResultAny || {}).filter((k) => k !== "accessToken"),
            walletSource,
            walletLen:            walletAddress ? String(walletAddress).length : 0,
            effectiveIncomingKyc,
            kycFromDeep,
            dbWalletLen:          user.wallet_address ? String(user.wallet_address).length : 0,
            dbKyc:                user.kyc_status,
            dbWalletVerified:     !!user.wallet_verified,
          }
        : undefined;

    // #region agent log
    fetch("http://127.0.0.1:7583/ingest/85ab3f18-cb22-483f-9206-fdd2fd446d94", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2cdd1d" },
      body:    JSON.stringify({
        sessionId:    "2cdd1d",
        runId:        "pi-auth-2",
        hypothesisId: "D,E",
        location:     "api/auth/pi/route.ts:beforeResponse",
        message:      "Post-DB user profile snapshot",
        data:         {
          dbWalletLen:      user.wallet_address ? String(user.wallet_address).length : 0,
          dbKyc:            user.kyc_status,
          dbWalletVerified: !!user.wallet_verified,
          isNewUser,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const token = signToken({
      userId:   user.id,
      piUid:    user.pi_uid,
      username: user.username,
      role:     user.role ?? "user",
    });

    return NextResponse.json({
      success: true,
      data:    { user, token, isNewUser, ...(authDebug ? { _authDebug: authDebug } : {}) },
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