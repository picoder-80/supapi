import { NextRequest, NextResponse } from "next/server";
import { creditSC, supabase } from "@/app/api/supanova/_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data: tournament } = await supabase.from("arcade_tournaments").select("*").eq("id", id).single();
  if (!tournament) return NextResponse.json({ success: false, error: "Tournament not found" }, { status: 404 });

  const { data: players } = await supabase
    .from("arcade_tournament_players")
    .select("*")
    .eq("tournament_id", id)
    .order("score", { ascending: false });

  const pool = Number(tournament.prize_pool_sc ?? 0);
  const payouts = [0.5, 0.3, 0.2];
  const winners: Array<{ user_id: string; rank: number; sc_won: number }> = [];
  for (let i = 0; i < Math.min(3, (players ?? []).length); i += 1) {
    const p = (players ?? [])[i] as any;
    const scWon = Number((pool * payouts[i]).toFixed(4));
    await supabase.from("arcade_tournament_players").update({ rank: i + 1, sc_won: scWon }).eq("id", p.id);
    if (scWon > 0) await creditSC(String(p.user_id), scWon, "arcade_tournament_prize", `🏆 Tournament prize rank ${i + 1}`);
    winners.push({ user_id: String(p.user_id), rank: i + 1, sc_won: scWon });
  }

  await supabase.from("arcade_tournaments").update({
    status: "completed",
    winner_user_id: winners[0]?.user_id ?? null,
  }).eq("id", id);

  return NextResponse.json({ success: true, winners });
}
