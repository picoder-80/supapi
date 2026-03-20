import type { SupabaseClient } from "@supabase/supabase-js";

export async function expireMarketPendingOrders(params: {
  supabase: SupabaseClient;
  limit?: number;
}) {
  const days = Math.max(1, Number(process.env.MARKET_PENDING_EXPIRE_DAYS ?? "7"));
  const limit = Math.max(1, Math.min(500, Number(params.limit ?? 200)));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: targets, error: selErr } = await params.supabase
    .from("orders")
    .select("id")
    .eq("status", "pending")
    .is("pi_payment_id", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (selErr) return { ok: false as const, error: selErr.message, expired: 0 };
  if (!targets?.length) return { ok: true as const, expired: 0, days, cutoff };

  const ids = targets.map((r: { id: string }) => r.id);
  const { error: upErr } = await params.supabase
    .from("orders")
    .update({
      status: "cancelled",
      notes: "[system] auto-cancelled after pending timeout",
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .eq("status", "pending")
    .is("pi_payment_id", null);

  if (upErr) return { ok: false as const, error: upErr.message, expired: 0 };
  return { ok: true as const, expired: ids.length, days, cutoff };
}
