import type { SupabaseClient } from "@supabase/supabase-js";
import { CLASSIFIED_BOOST_TIERS } from "@/lib/supasifieds/boost-tiers";

export type BoostTierConfig = { sc: number; hrs: number; label: string };
export type CarouselPackageConfig = { days: number; sc: number; label: string };
export type SpotlightPackageConfig = { days: number; sc: number; label: string };
export type AutoRepostPackageConfig = {
  id: string;
  interval_hours: number;
  days: number;
  sc: number;
  label: string;
};

const BOOST_KEY = "supasifieds_boost_tiers_json";
const CAROUSEL_KEY = "supasifieds_carousel_packages_json";
const SPOTLIGHT_KEY = "supasifieds_spotlight_packages_json";
const AUTOREPOST_KEY = "supasifieds_autorepost_packages_json";

export const DEFAULT_CAROUSEL_PACKAGES: CarouselPackageConfig[] = [
  { days: 3, sc: 180, label: "3 days carousel ad" },
  { days: 7, sc: 360, label: "7 days carousel ad" },
  { days: 14, sc: 650, label: "14 days carousel ad" },
];
export const DEFAULT_SPOTLIGHT_PACKAGES: SpotlightPackageConfig[] = [
  { days: 3, sc: 120, label: "3 days category spotlight" },
  { days: 7, sc: 250, label: "7 days category spotlight" },
  { days: 14, sc: 450, label: "14 days category spotlight" },
];
export const DEFAULT_AUTOREPOST_PACKAGES: AutoRepostPackageConfig[] = [
  { id: "24h_7d", interval_hours: 24, days: 7, sc: 120, label: "Every 24h / 7d" },
  { id: "12h_7d", interval_hours: 12, days: 7, sc: 200, label: "Every 12h / 7d" },
  { id: "6h_14d", interval_hours: 6, days: 14, sc: 420, label: "Every 6h / 14d" },
];

function toPositiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function normalizeBoostTiers(input: unknown): Record<string, BoostTierConfig> {
  const base = CLASSIFIED_BOOST_TIERS;
  if (!input || typeof input !== "object") return base;
  const source = input as Record<string, unknown>;
  const tiers: Record<string, BoostTierConfig> = {};
  for (const key of ["bronze", "silver", "gold"]) {
    const raw = (source[key] ?? {}) as Record<string, unknown>;
    const fallback = base[key];
    tiers[key] = {
      sc: toPositiveInt(raw.sc, fallback.sc),
      hrs: toPositiveInt(raw.hrs, fallback.hrs),
      label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : fallback.label,
    };
  }
  return tiers;
}

function normalizeCarouselPackages(input: unknown): CarouselPackageConfig[] {
  if (!Array.isArray(input)) return DEFAULT_CAROUSEL_PACKAGES;
  const normalized = input
    .map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const days = toPositiveInt(r.days, 0);
      const sc = toPositiveInt(r.sc, 0);
      if (!days || !sc) return null;
      const label =
        typeof r.label === "string" && r.label.trim()
          ? r.label.trim()
          : `${days} days carousel ad`;
      return { days, sc, label };
    })
    .filter((row): row is CarouselPackageConfig => Boolean(row));

  if (!normalized.length) return DEFAULT_CAROUSEL_PACKAGES;
  const uniqueByDays = new Map<number, CarouselPackageConfig>();
  for (const row of normalized) uniqueByDays.set(row.days, row);
  return Array.from(uniqueByDays.values()).sort((a, b) => a.days - b.days);
}

function normalizeSpotlightPackages(input: unknown): SpotlightPackageConfig[] {
  if (!Array.isArray(input)) return DEFAULT_SPOTLIGHT_PACKAGES;
  const normalized = input
    .map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const days = toPositiveInt(r.days, 0);
      const sc = toPositiveInt(r.sc, 0);
      if (!days || !sc) return null;
      const label =
        typeof r.label === "string" && r.label.trim()
          ? r.label.trim()
          : `${days} days category spotlight`;
      return { days, sc, label };
    })
    .filter((row): row is SpotlightPackageConfig => Boolean(row));
  if (!normalized.length) return DEFAULT_SPOTLIGHT_PACKAGES;
  const uniqueByDays = new Map<number, SpotlightPackageConfig>();
  for (const row of normalized) uniqueByDays.set(row.days, row);
  return Array.from(uniqueByDays.values()).sort((a, b) => a.days - b.days);
}

function normalizeAutoRepostPackages(input: unknown): AutoRepostPackageConfig[] {
  if (!Array.isArray(input)) return DEFAULT_AUTOREPOST_PACKAGES;
  const normalized = input
    .map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const interval_hours = toPositiveInt(r.interval_hours, 0);
      const days = toPositiveInt(r.days, 0);
      const sc = toPositiveInt(r.sc, 0);
      if (!interval_hours || !days || !sc) return null;
      const id =
        typeof r.id === "string" && r.id.trim()
          ? r.id.trim()
          : `${interval_hours}h_${days}d`;
      const label =
        typeof r.label === "string" && r.label.trim()
          ? r.label.trim()
          : `Every ${interval_hours}h / ${days}d`;
      return { id, interval_hours, days, sc, label };
    })
    .filter((row): row is AutoRepostPackageConfig => Boolean(row));
  if (!normalized.length) return DEFAULT_AUTOREPOST_PACKAGES;
  const uniqueById = new Map<string, AutoRepostPackageConfig>();
  for (const row of normalized) uniqueById.set(row.id, row);
  return Array.from(uniqueById.values());
}

export function serializeSupasifiedsMonetizationConfig(input: {
  boostTiers: Record<string, BoostTierConfig>;
  carouselPackages: CarouselPackageConfig[];
  spotlightPackages: SpotlightPackageConfig[];
  autorepostPackages: AutoRepostPackageConfig[];
}) {
  return [
    {
      key: BOOST_KEY,
      value: JSON.stringify(input.boostTiers),
      description: "Supasifieds boost tiers config JSON",
      updated_at: new Date().toISOString(),
    },
    {
      key: CAROUSEL_KEY,
      value: JSON.stringify(input.carouselPackages),
      description: "Supasifieds carousel package config JSON",
      updated_at: new Date().toISOString(),
    },
    {
      key: SPOTLIGHT_KEY,
      value: JSON.stringify(input.spotlightPackages),
      description: "Supasifieds spotlight package config JSON",
      updated_at: new Date().toISOString(),
    },
    {
      key: AUTOREPOST_KEY,
      value: JSON.stringify(input.autorepostPackages),
      description: "Supasifieds auto-repost package config JSON",
      updated_at: new Date().toISOString(),
    },
  ];
}

export async function getSupasifiedsMonetizationConfig(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("platform_config")
    .select("key,value")
    .in("key", [BOOST_KEY, CAROUSEL_KEY, SPOTLIGHT_KEY, AUTOREPOST_KEY]);

  const map = new Map((data ?? []).map((row: { key: string; value: string }) => [row.key, row.value]));
  const boostRaw = map.get(BOOST_KEY);
  const carouselRaw = map.get(CAROUSEL_KEY);
  const spotlightRaw = map.get(SPOTLIGHT_KEY);
  const autorepostRaw = map.get(AUTOREPOST_KEY);

  let boostParsed: unknown = null;
  let carouselParsed: unknown = null;
  let spotlightParsed: unknown = null;
  let autorepostParsed: unknown = null;
  try {
    boostParsed = boostRaw ? JSON.parse(boostRaw) : null;
  } catch {}
  try {
    carouselParsed = carouselRaw ? JSON.parse(carouselRaw) : null;
  } catch {}
  try {
    spotlightParsed = spotlightRaw ? JSON.parse(spotlightRaw) : null;
  } catch {}
  try {
    autorepostParsed = autorepostRaw ? JSON.parse(autorepostRaw) : null;
  } catch {}

  return {
    boostTiers: normalizeBoostTiers(boostParsed),
    carouselPackages: normalizeCarouselPackages(carouselParsed),
    spotlightPackages: normalizeSpotlightPackages(spotlightParsed),
    autorepostPackages: normalizeAutoRepostPackages(autorepostParsed),
  };
}
