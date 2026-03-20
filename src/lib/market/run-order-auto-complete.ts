import type { SupabaseClient } from "@supabase/supabase-js";
import {
  marketOrderCronOrigin,
  releaseEscrowForMarketOrderCompletion,
} from "@/lib/market/complete-market-order";

function daysToMs(d: number) {
  return Math.max(1, Math.min(90, d)) * 86_400_000;
}

export type MarketAutoCompleteResult = {
  auto_confirmed_receipt: number;
  auto_completed: number;
  skipped: number;
  failed: number;
  confirm_after_days: number;
  complete_after_days: number;
};

async function hasOpenDispute(supabase: SupabaseClient, orderId: string): Promise<boolean> {
  const { data } = await supabase
    .from("disputes")
    .select("id")
    .eq("order_id", orderId)
    .neq("status", "resolved")
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function hasPendingReturnRequest(supabase: SupabaseClient, orderId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("market_return_requests")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "pending_seller")
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

function isDue(iso: string | null | undefined, fallbackIso: string, ms: number): boolean {
  const base = iso ?? fallbackIso;
  if (!base) return false;
  return Date.now() - new Date(base).getTime() >= ms;
}

/**
 * Shopee-style: (1) shipped/meetup_set → delivered after N days if buyer silent.
 * (2) delivered → completed after M days if no pending return request.
 */
export async function runMarketOrderAutoComplete(params: {
  supabase: SupabaseClient;
  limit?: number;
}): Promise<MarketAutoCompleteResult> {
  const confirmDays = Math.min(90, Math.max(1, parseInt(process.env.MARKET_AUTO_CONFIRM_RECEIPT_DAYS ?? "7", 10) || 7));
  const completeDays = Math.min(30, Math.max(1, parseInt(process.env.MARKET_AUTO_COMPLETE_ORDER_DAYS ?? "3", 10) || 3));
  const confirmMs = daysToMs(confirmDays);
  const completeMs = daysToMs(completeDays);
  const limit = Math.min(80, Math.max(5, params.limit ?? 40));
  const origin = marketOrderCronOrigin();

  let auto_confirmed_receipt = 0;
  let auto_completed = 0;
  let skipped = 0;
  let failed = 0;

  const { data: shipRows, error: shipErr } = await supabase
    .from("orders")
    .select("id, status, updated_at, fulfilled_at")
    .in("status", ["shipped", "meetup_set"])
    .limit(limit);

  if (shipErr) {
    console.error("[auto-complete] ship query", shipErr);
    return {
      auto_confirmed_receipt: 0,
      auto_completed: 0,
      skipped: 0,
      failed: 1,
      confirm_after_days: confirmDays,
      complete_after_days: completeDays,
    };
  }

  for (const row of shipRows ?? []) {
    try {
      if (!(await isDue(row.fulfilled_at, row.updated_at, confirmMs))) {
        skipped += 1;
        continue;
      }
      if (await hasOpenDispute(supabase, row.id)) {
        skipped += 1;
        continue;
      }

      const now = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("orders")
        .update({
          status: "delivered",
          delivered_at: now,
          updated_at: now,
        })
        .eq("id", row.id)
        .in("status", ["shipped", "meetup_set"]);

      if (upErr) {
        failed += 1;
        console.warn("[auto-complete] deliver failed", row.id, upErr.message);
        continue;
      }
      auto_confirmed_receipt += 1;
      console.log(`[auto-complete] Auto-confirmed receipt order=${row.id}`);
    } catch (e) {
      failed += 1;
      console.warn("[auto-complete] deliver exception", row.id, e);
    }
  }

  const { data: delRows, error: delErr } = await supabase
    .from("orders")
    .select("id, listing_id, seller_id, updated_at, delivered_at")
    .eq("status", "delivered")
    .limit(limit);

  if (delErr) {
    console.error("[auto-complete] delivered query", delErr);
    failed += 1;
  } else {
    for (const row of delRows ?? []) {
      try {
        if (!(await isDue(row.delivered_at, row.updated_at, completeMs))) {
          skipped += 1;
          continue;
        }
        if (await hasOpenDispute(supabase, row.id)) {
          skipped += 1;
          continue;
        }
        if (await hasPendingReturnRequest(supabase, row.id)) {
          skipped += 1;
          continue;
        }

        const rel = await releaseEscrowForMarketOrderCompletion({
          supabase,
          orderId: row.id,
          origin,
          order: { listing_id: row.listing_id, seller_id: row.seller_id },
        });
        if (!rel.ok) {
          failed += 1;
          console.warn("[auto-complete] release failed", row.id, rel.error);
          continue;
        }

        const now = new Date().toISOString();
        const { error: compErr } = await supabase
          .from("orders")
          .update({ status: "completed", updated_at: now })
          .eq("id", row.id)
          .eq("status", "delivered");

        if (compErr) {
          failed += 1;
          console.warn("[auto-complete] complete failed", row.id, compErr.message);
          continue;
        }
        auto_completed += 1;
        console.log(`[auto-complete] Auto-completed order=${row.id}`);
      } catch (e) {
        failed += 1;
        console.warn("[auto-complete] complete exception", row.id, e);
      }
    }
  }

  return {
    auto_confirmed_receipt,
    auto_completed,
    skipped,
    failed,
    confirm_after_days: confirmDays,
    complete_after_days: completeDays,
  };
}
