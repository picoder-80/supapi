import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader, spendSC, supabase } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const userId = getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [{ data: tournament }, { data: settings }] = await Promise.all([
    supabase.from("arcade_tournaments").select("*").eq("id", id).single(),
    supabase.from("arcade_commission_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!tournament) return NextResponse.json({ success: false, error: "Tournament not found" }, { status: 404 });
  if (!["upcoming", "live"].includes(String(tournament.status))) {
    return NextResponse.json({ success: false, error: "Tournament not joinable" }, { status: 400 });
  }
  if (Number(tournament.current_players ?? 0) >= Number(tournament.max_players ?? 0)) {
    return NextResponse.json({ success: false, error: "Tournament full" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("arcade_tournament_players")
    .select("id")
    .eq("tournament_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return NextResponse.json({ success: false, error: "Already joined" }, { status: 400 });

  const entryFee = Number(tournament.entry_fee_sc ?? 0);
  const tournamentCutPct = Number(settings?.tournament_cut_pct ?? tournament.platform_cut_pct ?? 20);
  const spent = await spendSC(userId, entryFee, "arcade_tournament_join", `🏆 Join tournament ${tournament.name}`);
  if (!spent.ok) return NextResponse.json({ success: false, error: `Not enough SC. Need ${entryFee} SC` }, { status: 400 });

  const platformCut = entryFee * (tournamentCutPct / 100);
  const netToPool = entryFee - platformCut;

  await supabase.from("arcade_tournament_players").insert({
    tournament_id: id,
    user_id: userId,
    score: 0,
  });
  const nextPlayers = Number(tournament.current_players ?? 0) + 1;
  await supabase.from("arcade_tournaments").update({
    current_players: nextPlayers,
    prize_pool_sc: Number(tournament.prize_pool_sc ?? 0) + netToPool,
  }).eq("id", id);

  await supabase.from("arcade_revenue").insert({
    date: new Date().toISOString().slice(0, 10),
    source: "tournament_entry",
    gross_sc: entryFee,
    platform_cut_sc: platformCut,
    prize_paid_sc: 0,
    net_sc: platformCut,
  });

  return NextResponse.json({
    success: true,
    data: {
      prizePool: Number(tournament.prize_pool_sc ?? 0) + netToPool,
      playersJoined: nextPlayers,
    },
  });
}
