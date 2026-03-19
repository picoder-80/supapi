// lib/referral.ts

import { createAdminClient } from "@/lib/supabase/server";

const REFERRAL_REWARD_PI = 0.5;

export function generateReferralCode(username: string): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${username.substring(0, 4).toUpperCase()}${rand}`;
}

export async function processReferralReward(referredUserId: string): Promise<void> {
  const supabase = await createAdminClient();

  const { data: referral } = await supabase
    .from("referrals")
    .select("*")
    .eq("referred_id", referredUserId)
    .eq("reward_paid", false)
    .single();

  if (!referral) return;

  await supabase
    .from("referrals")
    .update({ reward_paid: true })
    .eq("id", referral.id);

  await supabase.from("transactions").insert({
    user_id: referral.referrer_id,
    type: "referral_reward",
    amount_pi: REFERRAL_REWARD_PI,
    pi_payment_id: `referral_${referral.id}`,
    reference_id: referral.id,
    reference_type: "referral",
    status: "completed",
    memo: "Referral reward — your friend made their first transaction",
  });

  // Keep referral earnings isolated in referral ledger (not the unified earnings_wallet),
  // so My Wallet / dashboard doesn't mix different HOLD policies.
  await supabase.from("referral_earnings").insert({
    earner_id: referral.referrer_id,
    source_user_id: referredUserId,
    platform: "first_purchase_reward",
    level: 1,
    rate_pct: 0,
    base_amount_pi: REFERRAL_REWARD_PI,
    earned_pi: REFERRAL_REWARD_PI,
    status: "pending", // follows referral hold policy (claimable via /api/referral/withdraw)
  });

  await updateReferralStats(supabase, referral.referrer_id);

  console.log(`[Referral] Rewarded ${REFERRAL_REWARD_PI} Pi to user ${referral.referrer_id}`);
}

function calcRank(stats: { total_referrals: number; network_size: number; total_earned_pi: number }) {
  if (stats.network_size >= 200 && stats.total_earned_pi >= 100) return "diamond";
  if (stats.network_size >= 50  && stats.total_earned_pi >= 25)  return "leader";
  if (stats.total_referrals >= 10 && stats.total_earned_pi >= 5) return "builder";
  return "pioneer";
}

async function updateReferralStats(supabase: Awaited<ReturnType<typeof createAdminClient>>, userId: string) {
  const [l1Count, networkCount, earningsRes] = await Promise.all([
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId).eq("level", 1),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
    supabase.from("referral_earnings").select("earned_pi, status").eq("earner_id", userId),
  ]);

  const earnings = earningsRes.data ?? [];
  const total = earnings.reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);
  const pending = earnings.filter(e => e.status === "pending").reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);
  const paid = earnings.filter(e => e.status === "paid").reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);

  const stats = {
    user_id: userId,
    total_referrals: l1Count.count ?? 0,
    network_size: networkCount.count ?? 0,
    total_earned_pi: total,
    pending_pi: pending,
    paid_pi: paid,
    rank: calcRank({ total_referrals: l1Count.count ?? 0, network_size: networkCount.count ?? 0, total_earned_pi: total }),
    updated_at: new Date().toISOString(),
  };

  await supabase.from("referral_stats").upsert(stats, { onConflict: "user_id" });
}
