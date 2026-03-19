import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CreditEarningsParams = {
  userId: string;
  type: string;
  source: string;
  amountPi: number;
  status?: "pending" | "available";
  refId?: string | null;
  note?: string | null;
};

type PlatformEarningParams = {
  userId: string;
  platform: string;
  event: string;
  amountPi: number;
  status?: "pending" | "available";
  refId: string;
  note?: string | null;
  sourceLabel?: string;
};

type PresetEarningParams = {
  userId: string;
  amountPi: number;
  refId: string;
  status?: "pending" | "available";
  note?: string | null;
};

const PLATFORM_EARNING_META: Record<string, { typePrefix: string; sourcePrefix: string }> = {
  market: { typePrefix: "market", sourcePrefix: "SupaMarket" },
  supascrow: { typePrefix: "supascrow", sourcePrefix: "SupaScrow" },
  referral: { typePrefix: "referral", sourcePrefix: "Referral" },
  supapod: { typePrefix: "tip", sourcePrefix: "SupaPod" },
};

export const EARNING_EVENT_PRESETS = {
  market_order_complete: { platform: "market", event: "order_complete", sourceLabel: "SupaMarket Order Complete" },
  supascrow_release: { platform: "supascrow", event: "release", sourceLabel: "SupaScrow Deal Release" },
  referral_commission: { platform: "referral", event: "commission", sourceLabel: "Referral Commission" },
  referral_first_purchase_reward: { platform: "referral", event: "first_purchase_reward", sourceLabel: "Referral First Purchase Reward" },
  supapod_tip: { platform: "supapod", event: "tip", sourceLabel: "SupaPod Tip" },
} as const;

export type EarningsPresetKey = keyof typeof EARNING_EVENT_PRESETS;

export async function creditEarningsBalance(params: CreditEarningsParams): Promise<{ ok: boolean; reason?: string }> {
  const amount = Number(params.amountPi ?? 0);
  if (!params.userId || !params.type || !params.source || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "invalid_input" };
  }

  const status = params.status ?? "available";
  const refId = (params.refId ?? "").trim();

  if (refId) {
    const { data: existing } = await supabase
      .from("earnings_transactions")
      .select("id")
      .eq("user_id", params.userId)
      .eq("type", params.type)
      .eq("ref_id", refId)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return { ok: true, reason: "duplicate_skipped" };
  }

  await supabase
    .from("earnings_wallet")
    .upsert({ user_id: params.userId }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: wallet } = await supabase
    .from("earnings_wallet")
    .select("pending_pi, available_pi, total_earned")
    .eq("user_id", params.userId)
    .single();

  if (!wallet) return { ok: false, reason: "wallet_not_found" };

  await supabase
    .from("earnings_wallet")
    .update({
      pending_pi: status === "pending" ? Number(wallet.pending_pi ?? 0) + amount : Number(wallet.pending_pi ?? 0),
      available_pi: status === "pending" ? Number(wallet.available_pi ?? 0) : Number(wallet.available_pi ?? 0) + amount,
      total_earned: Number(wallet.total_earned ?? 0) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);

  await supabase.from("earnings_transactions").insert({
    user_id: params.userId,
    type: params.type,
    source: params.source,
    amount_pi: amount,
    status,
    ref_id: refId || "",
    note: params.note ?? "",
  });

  return { ok: true };
}

export async function creditPlatformEarning(params: PlatformEarningParams): Promise<{ ok: boolean; reason?: string }> {
  const platform = String(params.platform ?? "").trim().toLowerCase();
  const event = String(params.event ?? "").trim().toLowerCase();
  const refId = String(params.refId ?? "").trim();
  const meta = PLATFORM_EARNING_META[platform] ?? { typePrefix: platform || "platform", sourcePrefix: params.platform || "Platform" };

  const type = `${meta.typePrefix}_${event}`.replace(/[^a-z0-9_]/g, "_");
  const source = params.sourceLabel?.trim() || `${meta.sourcePrefix} ${event.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}`;

  return creditEarningsBalance({
    userId: params.userId,
    type,
    source,
    amountPi: Number(params.amountPi),
    status: params.status ?? "available",
    refId,
    note: params.note ?? "",
  });
}

/**
 * Simplest integration path for new/legacy platform events.
 * 1) Add a preset in EARNING_EVENT_PRESETS.
 * 2) Call this function from the payout completion event.
 */
export async function creditPresetEarning(
  preset: EarningsPresetKey,
  params: PresetEarningParams
): Promise<{ ok: boolean; reason?: string }> {
  const cfg = EARNING_EVENT_PRESETS[preset];
  return creditPlatformEarning({
    userId: params.userId,
    platform: cfg.platform,
    event: cfg.event,
    amountPi: params.amountPi,
    status: params.status ?? "available",
    refId: params.refId,
    note: params.note ?? "",
    sourceLabel: cfg.sourceLabel,
  });
}
