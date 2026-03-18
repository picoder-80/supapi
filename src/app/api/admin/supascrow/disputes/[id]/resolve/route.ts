import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/security/audit";
import { logDisputeEvent } from "@/lib/security/dispute-audit";
import { executeOwnerTransfer, isOwnerTransferConfigured } from "@/lib/pi/payout";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSupaScrowCommissionPct(): Promise<number> {
  const { data } = await supabase.from("platform_config").select("value").eq("key", "commission_supascrow").maybeSingle();
  const pct = parseFloat(String(data?.value ?? "5")) || 0;
  return Math.min(50, Math.max(0, pct));
}

function calcCommission(gross: number, pct: number): { commissionPi: number; netPi: number } {
  const commissionPi = Math.round((gross * (pct / 100)) * 1000000) / 1000000;
  const netPi = Math.round((gross - commissionPi) * 1000000) / 1000000;
  return { commissionPi, netPi };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok || !auth.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.supascrow.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: disputeId } = await params;
  let body: { resolution: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const resolution = String(body.resolution ?? "").trim();
  if (!["release_to_seller", "refund_to_buyer"].includes(resolution)) {
    return NextResponse.json({ success: false, error: "resolution must be release_to_seller or refund_to_buyer" }, { status: 400 });
  }

  const { data: dispute, error: disputeErr } = await supabase
    .from("supascrow_disputes")
    .select("id, deal_id, resolution")
    .eq("id", disputeId)
    .single();

  if (disputeErr || !dispute) {
    return NextResponse.json({ success: false, error: "Dispute not found" }, { status: 404 });
  }
  if (dispute.resolution && dispute.resolution !== "pending") {
    return NextResponse.json({ success: false, error: "Dispute already resolved" }, { status: 400 });
  }

  const { data: deal, error: dealErr } = await supabase
    .from("supascrow_deals")
    .select("*")
    .eq("id", dispute.deal_id)
    .single();

  if (dealErr || !deal) {
    return NextResponse.json({ success: false, error: "Deal not found" }, { status: 404 });
  }
  if (deal.status !== "disputed") {
    return NextResponse.json({ success: false, error: "Deal is not in disputed status" }, { status: 400 });
  }

  const grossRounded = Math.round((Number(deal.amount_pi) || 0) * 1000000) / 1000000;
  const commissionPct = deal.currency === "pi" ? await getSupaScrowCommissionPct() : 0;
  const { commissionPi, netPi } = calcCommission(grossRounded, commissionPct);
  const sellerPayout = deal.currency === "pi" ? netPi : grossRounded;

  if (resolution === "release_to_seller") {
    if (deal.currency === "sc" && grossRounded > 0) {
      await supabase.from("supapi_credits").upsert({ user_id: deal.seller_id }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: w } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", deal.seller_id).single();
      const next = (Number(w?.balance ?? 0)) + grossRounded;
      await supabase.from("supapi_credits").update({ balance: next, total_earned: Number(w?.total_earned ?? 0) + grossRounded, updated_at: new Date().toISOString() }).eq("user_id", deal.seller_id);
      await supabase.from("credit_transactions").insert({ user_id: deal.seller_id, type: "earn", activity: "supascrow_release_admin", amount: grossRounded, balance_after: next, note: `SupaScrow admin release #${deal.id.slice(0, 8)}` });
    }
    if (deal.currency === "pi" && grossRounded > 0 && isOwnerTransferConfigured()) {
      const { data: seller } = await supabase.from("users").select("pi_uid, wallet_address, wallet_verified").eq("id", deal.seller_id).single();
      const s = seller as { pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } | null;
      const uid = s?.pi_uid?.trim();
      const wallet = s?.wallet_address?.trim();
      const hasActivatedWallet = !!wallet || !!s?.wallet_verified;
      if (uid && hasActivatedWallet) {
        const tx = await executeOwnerTransfer({ amountPi: sellerPayout, recipientUid: uid || undefined, destinationWallet: wallet || undefined, note: `SupaScrow admin release #${deal.id.slice(0, 8)}` });
        if (!tx.ok) {
          return NextResponse.json({ success: false, error: tx.message ?? "Pi payout failed" }, { status: 502 });
        }
        if (commissionPi > 0) {
          await supabase.from("admin_revenue").insert({
            platform: "supascrow",
            order_id: null,
            gross_pi: grossRounded,
            commission_pi: commissionPi,
            commission_pct: commissionPct,
          });
        }
      } else {
        return NextResponse.json({ success: false, error: "Seller must sign in with Pi and activate their wallet to receive Pi." }, { status: 400 });
      }
    }
    await supabase.from("supascrow_deals").update({ status: "released", released_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", deal.id);
  } else {
    if (deal.currency === "sc" && grossRounded > 0) {
      await supabase.from("supapi_credits").upsert({ user_id: deal.buyer_id }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: w } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", deal.buyer_id).single();
      const next = (Number(w?.balance ?? 0)) + grossRounded;
      await supabase.from("supapi_credits").update({ balance: next, total_earned: Number(w?.total_earned ?? 0) + grossRounded, updated_at: new Date().toISOString() }).eq("user_id", deal.buyer_id);
      await supabase.from("credit_transactions").insert({ user_id: deal.buyer_id, type: "earn", activity: "supascrow_refund_admin", amount: grossRounded, balance_after: next, note: `SupaScrow admin refund #${deal.id.slice(0, 8)}` });
    }
    await supabase.from("supascrow_deals").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", deal.id);
  }

  const now = new Date().toISOString();
  await supabase.from("supascrow_disputes").update({ resolution, resolved_by: auth.userId, resolved_at: now, updated_at: now }).eq("id", disputeId);

  await logAdminAction({
    adminUserId: auth.userId,
    action: "supascrow_dispute_resolve",
    targetType: "supascrow_dispute",
    targetId: disputeId,
    detail: { deal_id: deal.id, resolution },
  });
  await logDisputeEvent({
    platform: "supascrow",
    disputeId: disputeId,
    dealId: deal.id,
    actorType: "admin",
    actorId: auth.userId,
    eventType: "admin_resolved",
    fromStatus: "disputed",
    toStatus: resolution === "release_to_seller" ? "released" : "refunded",
    decision: resolution === "release_to_seller" ? "release" : "refund",
    reasonExcerpt: "Resolved by admin panel action.",
    metadata: { resolution },
  });

  return NextResponse.json({
    success: true,
    data: { message: resolution === "release_to_seller" ? "Funds released to seller" : "Refunded to buyer" },
  });
}
