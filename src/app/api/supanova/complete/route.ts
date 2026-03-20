import { NextRequest, NextResponse } from "next/server";
import { creditSC, getUserIdFromAuthHeader, readWallet, supabase } from "../_shared";

function dayStartIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const sessionId = String(body?.sessionId ?? "");
  const score = Number(body?.score ?? 0);
  const timeTaken = Number(body?.timeTaken ?? 0);
  if (!sessionId) return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });

  const { data: session } = await supabase.from("arcade_sessions").select("*").eq("id", sessionId).eq("user_id", userId).single();
  if (!session) return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
  if (String(session.status) === "completed") return NextResponse.json({ success: true, data: { scEarned: Number(session.sc_earned ?? 0), platformCut: Number(session.platform_cut_sc ?? 0) } });

  const [{ data: level }, { data: game }, { data: settings }] = await Promise.all([
    supabase.from("arcade_levels").select("*").eq("id", session.level_id).single(),
    supabase.from("arcade_games").select("*").eq("id", session.game_id).single(),
    supabase.from("arcade_commission_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!level || !game) return NextResponse.json({ success: false, error: "Game/level not found" }, { status: 404 });

  const gamePlayCutPct = Number(settings?.game_play_cut_pct ?? 30);
  const dailyLimit = Number(settings?.daily_earn_limit_sc ?? 500);
  const rewardPerLevel = Number(level.reward_sc ?? 0);
  const maxEarn = Number(game.max_earn_sc ?? 0);

  const grossEarn = Math.max(0, (Math.max(0, score) / 1000) * rewardPerLevel);
  const platformCut = grossEarn * (gamePlayCutPct / 100);
  let userGets = grossEarn - platformCut;
  if (maxEarn > 0) userGets = Math.min(userGets, maxEarn);

  const { data: todayRows } = await supabase
    .from("arcade_sessions")
    .select("sc_earned")
    .eq("user_id", userId)
    .gte("completed_at", dayStartIso())
    .eq("status", "completed");
  const earnedToday = (todayRows ?? []).reduce((s, r) => s + Number(r.sc_earned ?? 0), 0);
  const dailyRemaining = Math.max(0, dailyLimit - earnedToday);
  userGets = Math.max(0, Math.min(userGets, dailyRemaining));

  // Keep SC economy integer-based for compatibility with existing wallet schema/routes.
  const roundedUserGets = Math.max(0, Math.trunc(userGets));
  const roundedCut = Math.max(0, Number((grossEarn - roundedUserGets).toFixed(4)));

  let newBalance = Number((await readWallet(userId)).balance ?? 0);
  if (roundedUserGets > 0) {
    const shortSession = sessionId.slice(0, 8).toUpperCase();
    const rewardNote = `🎮 ${game.name} L${Number(level.level_number ?? 1)} reward #${shortSession}`;
    newBalance = await creditSC(userId, roundedUserGets, "arcade_play_complete", rewardNote, sessionId);
  }

  // Only the first request to flip active → completed may record leaderboard / revenue (stops concurrent double-count).
  const { data: transitioned, error: transErr } = await supabase
    .from("arcade_sessions")
    .update({
      score: Math.max(0, Math.floor(score)),
      time_taken_seconds: Math.max(0, Math.floor(timeTaken)),
      sc_earned: roundedUserGets,
      platform_cut_sc: roundedCut,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (transErr) {
    return NextResponse.json({ success: false, error: transErr.message }, { status: 500 });
  }

  if (!transitioned?.id) {
    const { data: latest } = await supabase.from("arcade_sessions").select("*").eq("id", sessionId).eq("user_id", userId).single();
    newBalance = Number((await readWallet(userId)).balance ?? 0);
    return NextResponse.json({
      success: true,
      data: {
        scEarned: Number(latest?.sc_earned ?? 0),
        platformCut: Number(latest?.platform_cut_sc ?? 0),
        newBalance,
        leaderboardRank: null,
        grossEarn: Number(grossEarn.toFixed(4)),
        dailyRemaining: Number(dailyRemaining.toFixed(4)),
        rewardMessage: "Session already completed.",
      },
    });
  }

  const { data: existingBoard } = await supabase
    .from("arcade_leaderboard")
    .select("*")
    .eq("game_id", session.game_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingBoard) {
    await supabase.from("arcade_leaderboard").insert({
      game_id: session.game_id,
      user_id: userId,
      high_score: Math.max(0, Math.floor(score)),
      total_plays: 1,
      total_sc_earned: roundedUserGets,
      updated_at: new Date().toISOString(),
    });
  } else {
    await supabase.from("arcade_leaderboard").update({
      high_score: Math.max(Number(existingBoard.high_score ?? 0), Math.floor(score)),
      total_plays: Number(existingBoard.total_plays ?? 0) + 1,
      total_sc_earned: Number(existingBoard.total_sc_earned ?? 0) + roundedUserGets,
      updated_at: new Date().toISOString(),
    }).eq("id", existingBoard.id);
  }

  await supabase.from("arcade_revenue").insert({
    date: new Date().toISOString().slice(0, 10),
    source: "game_play",
    gross_sc: Number(grossEarn.toFixed(4)),
    platform_cut_sc: roundedCut,
    prize_paid_sc: roundedUserGets,
    net_sc: roundedCut,
  });

  const { data: top50 } = await supabase
    .from("arcade_leaderboard")
    .select("user_id,high_score")
    .eq("game_id", session.game_id)
    .order("high_score", { ascending: false })
    .limit(50);
  const leaderboardRank = (top50 ?? []).findIndex((r) => String(r.user_id) === userId) + 1;

  return NextResponse.json({
    success: true,
    data: {
      scEarned: roundedUserGets,
      platformCut: roundedCut,
      newBalance,
      leaderboardRank: leaderboardRank > 0 ? leaderboardRank : null,
      grossEarn: Number(grossEarn.toFixed(4)),
      dailyRemaining: Number(dailyRemaining.toFixed(4)),
      rewardMessage:
        roundedUserGets <= 0
          ? (dailyRemaining <= 0
              ? "Daily earn limit reached. Try again tomorrow."
              : "Score too low for positive reward after commission.")
          : "Reward credited successfully.",
    },
  });
}
