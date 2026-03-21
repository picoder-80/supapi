export type MindPlanCode = "free" | "pro_monthly" | "power_monthly";

export const DEFAULT_SPREAD_PCT = 0.015;
export const QUOTE_TTL_SECONDS = 300;

export function addMonths(baseIso: string, months: number): string {
  const d = new Date(baseIso);
  d.setMonth(d.getMonth() + Math.max(1, months));
  return d.toISOString();
}

export function roundPi(v: number): number {
  return Math.ceil(v * 1_000_000) / 1_000_000;
}

export function computePiAmount(usd: number, piUsdRate: number, spreadPct = DEFAULT_SPREAD_PCT): number {
  const raw = usd / piUsdRate;
  return roundPi(raw * (1 + spreadPct));
}
