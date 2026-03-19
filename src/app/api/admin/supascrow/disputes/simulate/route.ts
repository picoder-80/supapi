import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { analyzeDispute, shouldAutoResolveDispute } from "@/lib/market/ai";

function isNoResponseReason(reason: string): boolean {
  const normalizedReason = (reason || "").toLowerCase();
  const rawKeywords = process.env.SUPASCROW_AI_FORCE_MANUAL_KEYWORDS
    ?? "no response,no reply,no update,tak respon,tak reply,tak balas,seller tak respon,seller tak reply,seller tak balas,ghosted,silent";
  const keywords = rawKeywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  return keywords.some((kw) => normalizedReason.includes(kw));
}

function getSupaScrowAutoPolicy(confidence: number, amount: number, currency: "pi" | "sc"): {
  ok: boolean;
  reason: "auto_disabled" | "confidence_too_low" | "amount_too_high" | "ok";
  threshold: number;
  max_auto_resolve: number;
} {
  const autoEnabled = (process.env.SUPASCROW_AI_AUTO_RESOLVE_ENABLED ?? "true").toLowerCase() !== "false";
  const threshold = Math.min(
    1,
    Math.max(0, Number(process.env.SUPASCROW_AI_AUTO_THRESHOLD ?? process.env.MARKET_AI_AUTO_RESOLVE_THRESHOLD ?? "0.78"))
  );

  if (!autoEnabled) {
    return { ok: false, reason: "auto_disabled", threshold, max_auto_resolve: 0 };
  }

  if (currency === "pi") {
    const marketPolicy = shouldAutoResolveDispute(confidence, amount);
    return {
      ok: marketPolicy.ok,
      reason: marketPolicy.reason,
      threshold: marketPolicy.threshold,
      max_auto_resolve: marketPolicy.max_auto_resolve_pi,
    };
  }

  const maxAuto = Number(process.env.SUPASCROW_AI_MAX_AUTO_SC ?? 5000);
  const safeMaxAuto = Number.isFinite(maxAuto) ? maxAuto : 5000;
  if (confidence < threshold) {
    return { ok: false, reason: "confidence_too_low", threshold, max_auto_resolve: safeMaxAuto };
  }
  if (amount > safeMaxAuto) {
    return { ok: false, reason: "amount_too_high", threshold, max_auto_resolve: safeMaxAuto };
  }
  return { ok: true, reason: "ok", threshold, max_auto_resolve: safeMaxAuto };
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.supascrow.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: {
    reason?: string;
    amount_pi?: number;
    currency?: "pi" | "sc";
    deal_status?: string;
    force_decision?: "refund" | "release" | "manual_review";
    force_confidence?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const reason = String(body.reason ?? "").trim();
  const amountPi = Number(body.amount_pi ?? 0);
  const currency = body.currency === "sc" ? "sc" : "pi";
  const orderStatus = String(body.deal_status ?? "funded");
  if (!reason) {
    return NextResponse.json({ success: false, error: "reason is required" }, { status: 400 });
  }

  const ai = await analyzeDispute({
    reason,
    amount_pi: amountPi,
    order_status: orderStatus,
  });
  const decision = body.force_decision ?? ai.decision;
  const confidence = Number.isFinite(Number(body.force_confidence)) ? Number(body.force_confidence) : ai.confidence;
  const noResponseReason = isNoResponseReason(reason);
  const effectiveDecision = noResponseReason ? "manual_review" : decision;
  const autoReleaseAllowed = (process.env.SUPASCROW_AI_ALLOW_AUTO_RELEASE ?? "false").toLowerCase() === "true";
  const autoPolicy = getSupaScrowAutoPolicy(confidence, amountPi, currency);
  const autoResolve =
    autoPolicy.ok &&
    !noResponseReason &&
    (
      effectiveDecision === "refund" ||
      (autoReleaseAllowed && effectiveDecision === "release")
    );

  const resolution = autoResolve
    ? (effectiveDecision === "refund" ? "refund_to_buyer" : "release_to_seller")
    : "pending_manual_review";

  return NextResponse.json({
    success: true,
    data: {
      input: { reason, amount_pi: amountPi, currency, deal_status: orderStatus },
      analysis: {
        ai_decision: ai.decision,
        ai_confidence: ai.confidence,
        ai_reasoning: ai.reasoning,
        effective_decision: effectiveDecision,
        no_response_reason: noResponseReason,
      },
      policy: {
        auto_release_allowed: autoReleaseAllowed,
        auto_policy_reason: autoPolicy.reason,
        auto_policy_threshold: autoPolicy.threshold,
        auto_policy_max_amount: autoPolicy.max_auto_resolve,
        auto_resolve: autoResolve,
        simulated_resolution: resolution,
      },
      overrides: {
        force_decision: body.force_decision ?? null,
        force_confidence: Number.isFinite(Number(body.force_confidence)) ? Number(body.force_confidence) : null,
      },
    },
  });
}

