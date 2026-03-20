import type { SupabaseClient } from "@supabase/supabase-js";
import { creditPresetEarning } from "@/lib/wallet/earnings";

export async function creditSellerEarningsMarket(params: {
  origin: string;
  sellerId: string;
  orderId: string;
  amountPi: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Primary path: direct DB credit (idempotent by refId/type) to avoid env/header mismatch issues.
  const direct = await creditPresetEarning("market_order_complete", {
    userId: params.sellerId,
    amountPi: params.amountPi,
    refId: params.orderId,
    status: "available",
    note: `Auto payout for completed order ${params.orderId}`,
  });

  if (direct.ok) return { ok: true };

  // Fallback path: legacy internal API credit.
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    console.warn(`[Earnings Credit] Direct credit failed for order ${params.orderId}: ${direct.reason ?? "unknown"}`);
    return { ok: false, reason: direct.reason ?? "direct_credit_failed" };
  }

  try {
    const response = await fetch(`${params.origin}/api/wallet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalSecret,
      },
      body: JSON.stringify({
        action: "credit_earnings",
        target_user_id: params.sellerId,
        type: "market_order",
        source: "Marketplace Order Completion",
        amount_pi: params.amountPi,
        status: "available",
        ref_id: params.orderId,
        note: `Auto payout for completed order ${params.orderId}`,
      }),
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => "");
      console.warn(`[Earnings Credit] Fallback failed for order ${params.orderId}: ${response.status} ${payload}`);
      return { ok: false, reason: `fallback_http_${response.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.warn(`[Earnings Credit] Fallback exception for order ${params.orderId}`, e);
    return { ok: false, reason: "fallback_exception" };
  }
}

type OrderRow = {
  listing_id?: string | null;
  seller_id?: string | null;
};

/**
 * Release escrow, record commission, credit seller wallet, decrement stock.
 * Call while order is still `delivered` before flipping to `completed`.
 */
export async function releaseEscrowForMarketOrderCompletion(params: {
  supabase: SupabaseClient;
  orderId: string;
  origin: string;
  order: OrderRow;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, orderId, origin, order } = params;

  const { data: earning, error: earnSelErr } = await supabase
    .from("seller_earnings")
    .select("id, commission_pi, gross_pi, net_pi, commission_pct, platform")
    .eq("order_id", orderId)
    .eq("status", "escrow")
    .maybeSingle();

  if (earnSelErr) return { ok: false, error: earnSelErr.message };

  if (earning) {
    const { error: upEarnErr } = await supabase
      .from("seller_earnings")
      .update({ status: "pending" })
      .eq("id", earning.id);
    if (upEarnErr) return { ok: false, error: upEarnErr.message };

    const { error: revErr } = await supabase.from("admin_revenue").insert({
      platform:       earning.platform,
      order_id:       orderId,
      gross_pi:       earning.gross_pi,
      commission_pi:  earning.commission_pi,
      commission_pct: earning.commission_pct,
    });
    if (revErr) return { ok: false, error: revErr.message };

    const sellerAmount = Number(earning.net_pi ?? 0);
    if (sellerAmount > 0 && order.seller_id) {
      const creditRes = await creditSellerEarningsMarket({
        origin,
        sellerId: String(order.seller_id),
        orderId,
        amountPi: sellerAmount,
      });
      if (!creditRes.ok) {
        return { ok: false, error: `Failed to credit seller earnings (${creditRes.reason})` };
      }
    }

    console.log(`[Escrow Released] orderId=${orderId} commission=${earning.commission_pi}π seller earnings unlocked`);
  }

  if (order.listing_id) {
    const { data: listing, error: listErr } = await supabase
      .from("listings")
      .select("id, stock")
      .eq("id", order.listing_id)
      .single();
    if (listErr) return { ok: false, error: listErr.message };

    if (listing) {
      const { error: stErr } = await supabase
        .from("listings")
        .update({ stock: Math.max(0, (listing.stock ?? 1) - 1), updated_at: new Date().toISOString() })
        .eq("id", listing.id);
      if (stErr) return { ok: false, error: stErr.message };
    }
  }

  return { ok: true };
}

export function marketOrderCronOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  );
}
