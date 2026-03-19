import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { creditPlatformEarning } from "@/lib/wallet/earnings";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUser(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; username: string };
  } catch { return null; }
}

async function getConfig() {
  const { data } = await supabase.from("platform_config").select("key,value")
    .in("key", ["referral_l1_pct","referral_l2_pct","referral_l3_pct","referral_join_bonus","referral_kyc_bonus","referral_monthly_cap","referral_hold_days"]);
  const cfg: Record<string, number> = {};
  data?.forEach(r => { cfg[r.key] = parseFloat(r.value); });
  return cfg;
}

function calcRank(stats: { total_referrals: number; network_size: number; total_earned_pi: number }) {
  if (stats.network_size >= 200 && stats.total_earned_pi >= 100) return "diamond";
  if (stats.network_size >= 50  && stats.total_earned_pi >= 25)  return "leader";
  if (stats.total_referrals >= 10 && stats.total_earned_pi >= 5) return "builder";
  return "pioneer";
}

// GET /api/referral — get my referral dashboard data
export async function GET(req: Request) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const [statsRes, l1Res, earningsRes, leaderboardRes, configRes] = await Promise.all([
    supabase.from("referral_stats").select("*").eq("user_id", user.userId).single(),
    supabase.from("referrals")
      .select("id, created_at, level, referee:users!referred_id(id, username, avatar_url, display_name)")
      .eq("referrer_id", user.userId)
      .eq("level", 1)
      .order("created_at", { ascending: false }),
    supabase.from("referral_earnings")
      .select("id, level, platform, earned_pi, base_amount_pi, rate_pct, status, created_at, source_user:users!source_user_id(username)")
      .eq("earner_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("referral_stats")
      .select("user_id, total_earned_pi, total_referrals, network_size, rank, users(username, avatar_url, display_name)")
      .order("total_earned_pi", { ascending: false })
      .limit(10),
    getConfig(),
  ]);

  // Get user's referral code (username)
  const { data: userData } = await supabase
    .from("users").select("username").eq("id", user.userId).single();

  return NextResponse.json({
    success: true,
    data: {
      stats:       statsRes.data ?? { total_referrals: 0, network_size: 0, total_earned_pi: 0, pending_pi: 0, paid_pi: 0, rank: "pioneer" },
      referrals:   l1Res.data ?? [],
      earnings:    earningsRes.data ?? [],
      leaderboard: leaderboardRes.data ?? [],
      config:      configRes,
      ref_code:    userData?.username ?? "",
    },
  });
}

// POST /api/referral — register referral when new user joins
export async function POST(req: Request) {
  const { referred_id, ref_code } = await req.json();
  if (!referred_id || !ref_code) return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });

  // Find referrer by username
  const { data: referrer } = await supabase
    .from("users").select("id").eq("username", ref_code).single();
  if (!referrer) return NextResponse.json({ success: false, error: "Invalid ref code" }, { status: 404 });
  if (referrer.id === referred_id) return NextResponse.json({ success: false, error: "Cannot self-refer" }, { status: 400 });

  // Check already referred
  const { data: existing } = await supabase
    .from("referrals").select("id").eq("referred_id", referred_id).single();
  if (existing) return NextResponse.json({ success: false, error: "Already referred" }, { status: 400 });

  // Insert L1
  await supabase.from("referrals").insert({ referrer_id: referrer.id, referred_id, level: 1 });

  // Find L1's referrer → insert L2
  const { data: l1ref } = await supabase
    .from("referrals").select("referrer_id").eq("referred_id", referrer.id).single();
  if (l1ref) {
    await supabase.from("referrals").insert({ referrer_id: l1ref.referrer_id, referred_id, level: 2 });

    // Find L2's referrer → insert L3
    const { data: l2ref } = await supabase
      .from("referrals").select("referrer_id").eq("referred_id", l1ref.referrer_id).single();
    if (l2ref) {
      await supabase.from("referrals").insert({ referrer_id: l2ref.referrer_id, referred_id, level: 3 });
    }
  }

  // Give join bonus to L1 referrer
  const cfg = await getConfig();
  if (cfg.referral_join_bonus > 0) {
    const joinRow = {
      earner_id: referrer.id,
      source_user_id: referred_id,
      platform: "join_bonus",
      level: 1,
      rate_pct: 0,
      base_amount_pi: 0,
      earned_pi: cfg.referral_join_bonus,
      status: "paid",
    };
    await supabase.from("referral_earnings").insert(joinRow);
    await creditPlatformEarning({
      userId: referrer.id,
      platform: "referral",
      event: "join_bonus",
      amountPi: Number(cfg.referral_join_bonus),
      status: "available",
      refId: `referral_join_${referred_id}`,
      note: "Referral join bonus",
    });
    await updateStats(referrer.id);
  }

  return NextResponse.json({ success: true });
}

async function updateStats(userId: string) {
  const [l1Count, networkCount, earningsRes] = await Promise.all([
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId).eq("level", 1),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
    supabase.from("referral_earnings").select("earned_pi, status").eq("earner_id", userId),
  ]);

  const earnings = earningsRes.data ?? [];
  const total    = earnings.reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);
  const pending  = earnings.filter(e => e.status === "pending").reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);
  const paid     = earnings.filter(e => e.status === "paid").reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);

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

// Export for use in other API routes (marketplace, academy, etc)
export async function processReferralCommission({
  buyer_id, platform, platform_fee_pi, transaction_id,
}: { buyer_id: string; platform: string; platform_fee_pi: number; transaction_id?: string }) {
  const cfg = await getConfig();
  const rates: Record<number, number> = {
    1: cfg.referral_l1_pct ?? 5,
    2: cfg.referral_l2_pct ?? 2,
    3: cfg.referral_l3_pct ?? 1,
  };

  // Get all referrers of this buyer
  const { data: refs } = await supabase
    .from("referrals")
    .select("referrer_id, level")
    .eq("referred_id", buyer_id);

  if (!refs?.length) return;

  // Check monthly cap per earner
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0,0,0,0);

  for (const ref of refs) {
    const rate    = rates[ref.level] ?? 0;
    const earned  = (platform_fee_pi * rate) / 100;
    if (earned <= 0) continue;

    // Check monthly cap
    const { data: monthEarnings } = await supabase
      .from("referral_earnings")
      .select("earned_pi")
      .eq("earner_id", ref.referrer_id)
      .gte("created_at", monthStart.toISOString());

    const monthTotal = monthEarnings?.reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0) ?? 0;
    if (monthTotal >= (cfg.referral_monthly_cap ?? 50)) continue;

    const earnedAmount = Math.min(earned, (cfg.referral_monthly_cap ?? 50) - monthTotal);
    await supabase.from("referral_earnings").insert({
      earner_id:      ref.referrer_id,
      source_user_id: buyer_id,
      transaction_id: transaction_id ?? null,
      platform,
      level:          ref.level,
      rate_pct:       rate,
      base_amount_pi: platform_fee_pi,
      earned_pi:      earnedAmount,
      status:         "pending",
    });
    await creditPlatformEarning({
      userId: ref.referrer_id,
      platform: "referral",
      event: "commission",
      amountPi: earnedAmount,
      status: "pending",
      refId: `${platform}_${transaction_id ?? buyer_id}_${ref.level}`,
      note: `Level ${ref.level} referral commission (${platform})`,
    });

    await updateStats(ref.referrer_id);
  }
}