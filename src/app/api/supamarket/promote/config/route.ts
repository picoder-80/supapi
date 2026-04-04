import { NextResponse } from "next/server";

const BOOST_TIERS = {
  bronze: { sc: 100, hrs: 24, label: "🥉 Bronze · 24h" },
  silver: { sc: 250, hrs: 48, label: "🥈 Silver · 48h" },
  gold: { sc: 500, hrs: 72, label: "👑 Gold · 72h" },
};

const CAROUSEL_PACKAGES = [
  { days: 3, sc: 180, label: "3 days carousel ad" },
  { days: 7, sc: 360, label: "7 days carousel ad" },
  { days: 14, sc: 650, label: "14 days carousel ad" },
];

const SPOTLIGHT_PACKAGES = [
  { days: 3, sc: 120, label: "3 days category spotlight" },
  { days: 7, sc: 250, label: "7 days category spotlight" },
  { days: 14, sc: 450, label: "14 days category spotlight" },
];

const AUTOREPOST_PACKAGES = [
  { id: "24h_7d", interval_hours: 24, days: 7, sc: 120, label: "Every 24h / 7d" },
  { id: "12h_7d", interval_hours: 12, days: 7, sc: 200, label: "Every 12h / 7d" },
  { id: "6h_14d", interval_hours: 6, days: 14, sc: 420, label: "Every 6h / 14d" },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      boostTiers: BOOST_TIERS,
      carouselPackages: CAROUSEL_PACKAGES,
      spotlightPackages: SPOTLIGHT_PACKAGES,
      autorepostPackages: AUTOREPOST_PACKAGES,
    },
  });
}
