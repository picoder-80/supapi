// lib/live/payments.ts
// Shared utilities for live streaming payment flows

export const LIVE_QUOTE_TTL_SECONDS = 300; // 5 minutes
export const LIVE_SPREAD_PCT = 0.015;      // 1.5% spread same as SupaMinds

export function roundPi(v: number): number {
  return Math.ceil(v * 1_000_000) / 1_000_000;
}

export function computePiAmount(
  usd: number,
  piUsdRate: number,
  spreadPct = LIVE_SPREAD_PCT
): number {
  const raw = usd / piUsdRate;
  return roundPi(raw * (1 + spreadPct));
}

export function addDays(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Check if user has active monthly live subscription
export async function hasActiveLiveSubscription(
  supabase: any,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("live_subscriptions")
    .select("id, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return false;
  const periodEnd = new Date(data.current_period_end).getTime();
  return periodEnd > Date.now();
}
