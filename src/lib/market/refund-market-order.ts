import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Refund a SupaMarket order while escrow is still held (order not completed).
 * Cancels seller_earnings in escrow and sets order to refunded.
 */
export async function refundMarketOrderEscrow(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const { error: oErr } = await supabase
    .from("orders")
    .update({ status: "refunded", updated_at: now })
    .eq("id", orderId);
  if (oErr) return { ok: false, error: oErr.message };

  const { error: eErr } = await supabase
    .from("seller_earnings")
    .update({ status: "cancelled" })
    .eq("order_id", orderId)
    .eq("status", "escrow");
  if (eErr) return { ok: false, error: eErr.message };

  return { ok: true };
}
