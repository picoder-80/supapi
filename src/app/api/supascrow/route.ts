import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { executeOwnerTransfer, isOwnerTransferConfigured } from "@/lib/pi/payout";
import { creditPlatformEarning } from "@/lib/wallet/earnings";
import { applyReferralCommissionForSettlement } from "@/lib/referral/commission";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId?: string; id?: string; sub?: string };
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch {
    return null;
  }
}

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  created: ["accepted", "cancelled"],
  accepted: ["funded", "cancelled"],
  funded: ["shipped"],
  shipped: ["delivered", "disputed"],
  delivered: ["released"],
  disputed: ["released", "refunded"],
};

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

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  const role = searchParams.get("role") ?? "all"; // all | buyer | seller
  const lookup = searchParams.get("lookup")?.trim(); // username lookup for create form

  if (lookup) {
    const { data: u } = await supabase.from("users").select("id, username, display_name").ilike("username", lookup).limit(1).maybeSingle();
    return NextResponse.json({ success: true, data: u ? { id: u.id, username: u.username, display_name: u.display_name } : null });
  }

  if (dealId) {
    const { data: deal, error: dealErr } = await supabase
      .from("supascrow_deals")
      .select("*")
      .eq("id", dealId)
      .single();

    if (dealErr || !deal) {
      return NextResponse.json({ success: false, error: "Deal not found" }, { status: 404 });
    }

    const isParty = deal.buyer_id === userId || deal.seller_id === userId;
    if (!isParty) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const { data: messages } = await supabase
      .from("supascrow_messages")
      .select("id, sender_id, body, created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true });

    const partyIds = [...new Set([deal.buyer_id, deal.seller_id, ...(messages ?? []).map((m: { sender_id: string }) => m.sender_id)])];
    const { data: users } = await supabase.from("users").select("id, username, display_name, avatar_url, pi_uid, wallet_address, wallet_verified").in("id", partyIds);
    const userMap = new Map((users ?? []).map((u: { id: string }) => [u.id, u]));

    const toParty = (u: { id: string; username?: string; display_name?: string | null; avatar_url?: string | null; pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } | undefined, id: string) => {
      if (!u) return { id, username: "?", display_name: null, avatar_url: null, can_receive_pi: false };
      const { pi_uid, wallet_address, wallet_verified, ...rest } = u;
      const hasPiUid = !!(pi_uid && String(pi_uid).trim());
      const hasActivatedWallet = !!(wallet_address && String(wallet_address).trim()) || !!wallet_verified;
      return { ...rest, can_receive_pi: hasPiUid && hasActivatedWallet };
    };

    const dealWithParties = {
      ...deal,
      buyer: toParty(userMap.get(deal.buyer_id) as { id: string; username?: string; display_name?: string | null; avatar_url?: string | null; pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } | undefined, deal.buyer_id),
      seller: toParty(userMap.get(deal.seller_id) as { id: string; username?: string; display_name?: string | null; avatar_url?: string | null; pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } | undefined, deal.seller_id),
    };
    const toSender = (u: { id: string; username?: string; display_name?: string | null; avatar_url?: string | null; pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } | undefined, id: string) => {
      if (!u) return { id, username: "?", display_name: null, avatar_url: null };
      const { pi_uid: _, wallet_address: __, wallet_verified: ___, ...rest } = u;
      return rest;
    };
    const messagesWithSenders = (messages ?? []).map((m: { sender_id: string }) => ({
      ...m,
      sender: toSender(userMap.get(m.sender_id) as { id: string; username?: string; display_name?: string | null; avatar_url?: string | null; pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } | undefined, m.sender_id),
    }));

    return NextResponse.json({
      success: true,
      data: { deal: dealWithParties, messages: messagesWithSenders },
    });
  }

  let query = supabase
    .from("supascrow_deals")
    .select("id, title, amount_pi, currency, status, buyer_id, seller_id, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (role === "buyer") query = query.eq("buyer_id", userId);
  else if (role === "seller") query = query.eq("seller_id", userId);
  else query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

  const { data: deals, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const list = deals ?? [];
  const partyIds = [...new Set(list.flatMap((d: { buyer_id: string; seller_id: string }) => [d.buyer_id, d.seller_id]))];
  const { data: users } = await supabase.from("users").select("id, username, display_name").in("id", partyIds);
  const userMap = new Map((users ?? []).map((u: { id: string }) => [u.id, u]));

  const enriched = list.map((d: { buyer_id: string; seller_id: string }) => ({
    ...d,
    buyer: userMap.get(d.buyer_id) ?? { id: d.buyer_id, username: "?", display_name: null },
    seller: userMap.get(d.seller_id) ?? { id: d.seller_id, username: "?", display_name: null },
  }));

  return NextResponse.json({ success: true, data: { deals: enriched } });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action ?? "");

  if (action === "create") {
    const sellerId = String(body.seller_id ?? "");
    const title = String(body.title ?? "").trim();
    const amountPi = Number(body.amount_pi ?? 0);
    const description = String(body.description ?? "").trim();
    const terms = String(body.terms ?? "").trim();
    const currency = (body.currency === "sc" ? "sc" : "pi") as "pi" | "sc";

    if (!sellerId || !title || amountPi <= 0) {
      return NextResponse.json({ success: false, error: "Missing seller_id, title, or amount_pi" }, { status: 400 });
    }
    if (sellerId === userId) {
      return NextResponse.json({ success: false, error: "Cannot create deal with yourself" }, { status: 400 });
    }

    const { data: deal, error: insertErr } = await supabase
      .from("supascrow_deals")
      .insert({
        buyer_id: userId,
        seller_id: sellerId,
        amount_pi: amountPi,
        currency,
        title,
        description: description || null,
        terms: terms || null,
        status: "created",
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { deal } });
  }

  if (action === "fund") {
    const dealId = String(body.deal_id ?? "");
    if (!dealId) return NextResponse.json({ success: false, error: "Missing deal_id" }, { status: 400 });

    const { data: deal, error: dealErr } = await supabase.from("supascrow_deals").select("*").eq("id", dealId).single();
    if (dealErr || !deal) return NextResponse.json({ success: false, error: "Deal not found" }, { status: 404 });
    if (deal.buyer_id !== userId) return NextResponse.json({ success: false, error: "Only buyer can fund" }, { status: 403 });
    if (deal.status !== "accepted") return NextResponse.json({ success: false, error: "Deal must be accepted first" }, { status: 400 });

    const amount = Math.round(Number(deal.amount_pi) || 0);
    if (amount <= 0) return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });

    if (deal.currency === "pi") {
      return NextResponse.json(
        { success: false, error: "Use Pi payment to fund. Open in Pi Browser and click Fund Escrow." },
        { status: 400 }
      );
    }

    if (deal.currency === "sc") {
      await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_spent").eq("user_id", userId).single();
      const current = Number(wallet?.balance ?? 0);
      if (current < amount) return NextResponse.json({ success: false, error: "Insufficient SC balance" }, { status: 400 });
      const next = current - amount;
      await supabase.from("supapi_credits").update({ balance: next, total_spent: Number(wallet?.total_spent ?? 0) + amount, updated_at: new Date().toISOString() }).eq("user_id", userId);
      await supabase.from("credit_transactions").insert({ user_id: userId, type: "spend", activity: "supascrow_escrow", amount: -amount, balance_after: next, note: `SupaScrow escrow #${dealId.slice(0, 8)}` });
    }
    const { error: upErr } = await supabase.from("supascrow_deals").update({ status: "funded", updated_at: new Date().toISOString() }).eq("id", dealId);
    if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
    return NextResponse.json({ success: true, data: { message: "Escrow funded" } });
  }

  if (action === "accept" || action === "add_tracking" || action === "confirm_delivery" || action === "release" || action === "cancel") {
    const dealId = String(body.deal_id ?? "");
    if (!dealId) {
      return NextResponse.json({ success: false, error: "Missing deal_id" }, { status: 400 });
    }

    const { data: deal, error: fetchErr } = await supabase
      .from("supascrow_deals")
      .select("*")
      .eq("id", dealId)
      .single();

    if (fetchErr || !deal) {
      return NextResponse.json({ success: false, error: "Deal not found" }, { status: 404 });
    }

    const allowed = VALID_STATUS_TRANSITIONS[deal.status] ?? [];
    const isBuyer = deal.buyer_id === userId;
    const isSeller = deal.seller_id === userId;

    if (action === "accept") {
      if (!isSeller) return NextResponse.json({ success: false, error: "Only seller can accept" }, { status: 403 });
      if (!allowed.includes("accepted")) return NextResponse.json({ success: false, error: "Invalid status transition" }, { status: 400 });
      const { error: upErr } = await supabase.from("supascrow_deals").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", dealId);
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
      return NextResponse.json({ success: true, data: { message: "Deal accepted" } });
    }

    if (action === "add_tracking") {
      if (!isSeller) return NextResponse.json({ success: false, error: "Only seller can add tracking" }, { status: 403 });
      if (deal.status !== "funded") return NextResponse.json({ success: false, error: "Deal must be funded first" }, { status: 400 });
      const trackingNumber = String(body.tracking_number ?? "").trim();
      const trackingCarrier = String(body.tracking_carrier ?? "").trim();
      const { error: upErr } = await supabase.from("supascrow_deals").update({ status: "shipped", tracking_number: trackingNumber || null, tracking_carrier: trackingCarrier || null, updated_at: new Date().toISOString() }).eq("id", dealId);
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
      return NextResponse.json({ success: true, data: { message: "Tracking added" } });
    }

    if (action === "confirm_delivery") {
      if (!isBuyer) return NextResponse.json({ success: false, error: "Only buyer can confirm delivery" }, { status: 403 });
      if (deal.status !== "shipped") return NextResponse.json({ success: false, error: "Deal must be shipped first" }, { status: 400 });
      const { error: upErr } = await supabase.from("supascrow_deals").update({ status: "delivered", updated_at: new Date().toISOString() }).eq("id", dealId);
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
      return NextResponse.json({ success: true, data: { message: "Delivery confirmed" } });
    }

    if (action === "release") {
      if (!isBuyer) return NextResponse.json({ success: false, error: "Only buyer can release funds" }, { status: 403 });
      if (deal.status !== "delivered") return NextResponse.json({ success: false, error: "Deal must be delivered first" }, { status: 400 });
      const gross = Number(deal.amount_pi) || 0;
      const grossRounded = Math.round(gross * 1000000) / 1000000;

      // Commission only applies to Pi (SC: no commission for now)
      const commissionPct = deal.currency === "pi" ? await getSupaScrowCommissionPct() : 0;
      const { commissionPi, netPi } = calcCommission(grossRounded, commissionPct);
      const sellerPayout = deal.currency === "pi" ? netPi : grossRounded;

      if (deal.currency === "sc" && grossRounded > 0) {
        await supabase.from("supapi_credits").upsert({ user_id: deal.seller_id }, { onConflict: "user_id", ignoreDuplicates: true });
        const { data: w } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", deal.seller_id).single();
        const next = (Number(w?.balance ?? 0)) + grossRounded;
        await supabase.from("supapi_credits").update({ balance: next, total_earned: Number(w?.total_earned ?? 0) + grossRounded, updated_at: new Date().toISOString() }).eq("user_id", deal.seller_id);
        await supabase.from("credit_transactions").insert({ user_id: deal.seller_id, type: "earn", activity: "supascrow_release", amount: grossRounded, balance_after: next, note: `SupaScrow release #${dealId.slice(0, 8)}` });
      }

      if (deal.currency === "pi" && grossRounded > 0) {
        const { data: seller } = await supabase.from("users").select("pi_uid, wallet_address, wallet_verified").eq("id", deal.seller_id).single();
        const s = seller as { pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } | null;
        const uid = s?.pi_uid?.trim();
        const wallet = s?.wallet_address?.trim();
        const hasActivatedWallet = !!wallet || !!s?.wallet_verified;
        if (!uid || !hasActivatedWallet) {
          return NextResponse.json(
            { success: false, error: "Seller must sign in with Pi and activate their wallet before Pi can be released." },
            { status: 400 }
          );
        }
        if (!isOwnerTransferConfigured()) {
          return NextResponse.json(
            { success: false, error: "Pi payout not configured. Contact admin to set PI_PAYOUT_API_URL." },
            { status: 503 }
          );
        }
        const transfer = await executeOwnerTransfer({
          amountPi: sellerPayout,
          recipientUid: uid || undefined,
          destinationWallet: wallet || undefined,
          note: `SupaScrow release #${dealId.slice(0, 8)}`,
        });
        if (!transfer.ok) {
          return NextResponse.json(
            { success: false, error: transfer.message ?? "Pi payout failed" },
            { status: 502 }
          );
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
        await creditPlatformEarning({
          userId: deal.seller_id,
          platform: "supascrow",
          event: "release",
          amountPi: sellerPayout,
          status: "available",
          refId: dealId,
          note: `SupaScrow release ${dealId}`,
        });
        if (commissionPi > 0) {
          await applyReferralCommissionForSettlement({
            buyerUserId: deal.buyer_id,
            platform: "supascrow",
            platformFeePi: commissionPi,
            settlementId: dealId,
          });
        }
      }

      const { error: upErr } = await supabase.from("supascrow_deals").update({ status: "released", released_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", dealId);
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
      return NextResponse.json({ success: true, data: { message: "Funds released to seller" } });
    }

    if (action === "cancel") {
      if (!isBuyer && !isSeller) return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
      if (!["created", "accepted"].includes(deal.status)) return NextResponse.json({ success: false, error: "Cannot cancel at this stage" }, { status: 400 });
      const { error: upErr } = await supabase.from("supascrow_deals").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", dealId);
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
      return NextResponse.json({ success: true, data: { message: "Deal cancelled" } });
    }

  }

  if (action === "send_message") {
    const dealId = String(body.deal_id ?? "");
    const bodyText = String(body.body ?? "").trim();
    if (!dealId || !bodyText) {
      return NextResponse.json({ success: false, error: "Missing deal_id or body" }, { status: 400 });
    }

    const { data: deal, error: dealErr } = await supabase.from("supascrow_deals").select("buyer_id, seller_id").eq("id", dealId).single();
    if (dealErr || !deal) return NextResponse.json({ success: false, error: "Deal not found" }, { status: 404 });
    const isParty = deal.buyer_id === userId || deal.seller_id === userId;
    if (!isParty) return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });

    const { data: msg, error: msgErr } = await supabase
      .from("supascrow_messages")
      .insert({ deal_id: dealId, sender_id: userId, body: bodyText })
      .select()
      .single();

    if (msgErr) return NextResponse.json({ success: false, error: msgErr.message }, { status: 500 });
    return NextResponse.json({ success: true, data: { message: msg } });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}
