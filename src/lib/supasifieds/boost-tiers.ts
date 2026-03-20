/** Same SC tiers as SupaMarket listing boost — single source for UI + API validation. */
export const CLASSIFIED_BOOST_TIERS: Record<string, { sc: number; hrs: number; label: string }> = {
  bronze: { sc: 100, hrs: 24, label: "🥉 Bronze Boost · 24h" },
  silver: { sc: 250, hrs: 48, label: "🥈 Silver Boost · 48h" },
  gold: { sc: 500, hrs: 72, label: "👑 Gold Boost · 72h" },
};
