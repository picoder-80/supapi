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

  console.log(`[Referral] Rewarded ${REFERRAL_REWARD_PI} Pi to user ${referral.referrer_id}`);
}
