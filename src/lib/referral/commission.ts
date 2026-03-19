import { createAdminClient } from "@/lib/supabase/server";

async function getReferralCommissionConfig() {
  const supabase = await createAdminClient();
  const { data } = await supabase.from("platform_config").select("key,value")
    .in("key", ["referral_l1_pct", "referral_l2_pct", "referral_l3_pct", "referral_monthly_cap"]);
  const cfg: Record<string, number> = {};
  data?.forEach((r) => { cfg[r.key] = parseFloat(r.value); });
  return cfg;
}

function normalizePlatformKey(platform: string): string {
  return String(platform ?? "").trim().toLowerCase().slice(0, 64) || "unknown";
}

export async function applyReferralCommissionForSettlement(params: {
  buyerUserId: string;
  platform: string;
  platformFeePi: number;
  settlementId?: string;
}) {
  const buyerId = String(params.buyerUserId ?? "").trim();
  const platform = normalizePlatformKey(params.platform);
  const platformFeePi = Number(params.platformFeePi ?? 0);
  const transactionId = String(params.settlementId ?? "").trim() || null;
  if (!buyerId || !Number.isFinite(platformFeePi) || platformFeePi <= 0) return;

  const cfg = await getReferralCommissionConfig();
  const rates: Record<number, number> = {
    1: cfg.referral_l1_pct ?? 5,
    2: cfg.referral_l2_pct ?? 2,
    3: cfg.referral_l3_pct ?? 1,
  };
  const monthlyCap = cfg.referral_monthly_cap ?? 50;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const supabase = await createAdminClient();
  const { data: refs } = await supabase
    .from("referrals")
    .select("referrer_id, level")
    .eq("referred_id", buyerId);
  if (!refs?.length) return;

  for (const ref of refs) {
    if (!ref?.referrer_id || !ref?.level) continue;
    if (transactionId) {
      const { data: existing } = await supabase
        .from("referral_earnings")
        .select("id")
        .eq("earner_id", ref.referrer_id)
        .eq("transaction_id", transactionId)
        .eq("platform", platform)
        .eq("level", ref.level)
        .maybeSingle();
      if (existing?.id) continue;
    }

    const rate = rates[ref.level] ?? 0;
    const earned = (platformFeePi * rate) / 100;
    if (earned <= 0) continue;

    const { data: monthEarnings } = await supabase
      .from("referral_earnings")
      .select("earned_pi")
      .eq("earner_id", ref.referrer_id)
      .gte("created_at", monthStart.toISOString());
    const monthTotal = monthEarnings?.reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0) ?? 0;
    if (monthTotal >= monthlyCap) continue;

    const earnedAmount = Math.min(earned, monthlyCap - monthTotal);
    await supabase.from("referral_earnings").insert({
      earner_id: ref.referrer_id,
      source_user_id: buyerId,
      transaction_id: transactionId,
      platform,
      level: ref.level,
      rate_pct: rate,
      base_amount_pi: platformFeePi,
      earned_pi: earnedAmount,
      status: "pending",
    });
  }

  const impactedEarnerIds = [...new Set(refs.map((r) => String(r.referrer_id)).filter(Boolean))];
  for (const earnerId of impactedEarnerIds) {
    const [l1Count, networkCount, earningsRes] = await Promise.all([
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", earnerId).eq("level", 1),
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", earnerId),
      supabase.from("referral_earnings").select("earned_pi, status").eq("earner_id", earnerId),
    ]);
    const earnings = earningsRes.data ?? [];
    const total = earnings.reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);
    const pending = earnings.filter((e) => e.status === "pending").reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);
    const paid = earnings.filter((e) => e.status === "paid").reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);
    const rank =
      (networkCount.count ?? 0) >= 200 && total >= 100 ? "diamond" :
      (networkCount.count ?? 0) >= 50 && total >= 25 ? "leader" :
      (l1Count.count ?? 0) >= 10 && total >= 5 ? "builder" :
      "pioneer";
    await supabase.from("referral_stats").upsert({
      user_id: earnerId,
      total_referrals: l1Count.count ?? 0,
      network_size: networkCount.count ?? 0,
      total_earned_pi: total,
      pending_pi: pending,
      paid_pi: paid,
      rank,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }
}

