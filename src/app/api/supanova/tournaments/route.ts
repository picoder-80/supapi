import { NextResponse } from "next/server";
import { supabase } from "../_shared";

export async function GET() {
  const { data, error } = await supabase.from("arcade_tournaments").select("*").order("starts_at", { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const gameIds = [...new Set((data ?? []).map((x: any) => String(x.game_id)).filter(Boolean))];
  const { data: games } = gameIds.length ? await supabase.from("arcade_games").select("id,name,icon,slug").in("id", gameIds) : { data: [] as any[] };
  const gameMap = new Map((games ?? []).map((g: any) => [String(g.id), g]));
  return NextResponse.json({ success: true, data: (data ?? []).map((x: any) => ({ ...x, game: gameMap.get(String(x.game_id)) ?? null })) });
}
