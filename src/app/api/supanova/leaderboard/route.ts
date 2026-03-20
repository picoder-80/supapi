import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../_shared";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gameSlug = String(searchParams.get("gameSlug") ?? "");

  let gameId: string | null = null;
  if (gameSlug) {
    const { data: game } = await supabase.from("arcade_games").select("id").eq("slug", gameSlug).maybeSingle();
    gameId = String(game?.id ?? "");
  }

  let query = supabase
    .from("arcade_leaderboard")
    .select("id,game_id,user_id,high_score,total_plays,total_sc_earned,updated_at")
    .order("high_score", { ascending: false })
    .limit(50);
  if (gameId) query = query.eq("game_id", gameId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const userIds = [...new Set((data ?? []).map((r) => String(r.user_id)))];
  const { data: users } = userIds.length
    ? await supabase.from("users").select("id,username,display_name").in("id", userIds)
    : { data: [] as any[] };
  const userMap = new Map((users ?? []).map((u: any) => [String(u.id), u]));

  const rows = (data ?? []).map((r, idx) => ({
    rank: idx + 1,
    ...r,
    user: userMap.get(String(r.user_id)) ?? null,
  }));
  return NextResponse.json({ success: true, data: rows });
}
