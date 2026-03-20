import { NextResponse } from "next/server";
import { supabase } from "@/app/api/supanova/_shared";

export async function GET() {
  const { data: games, error } = await supabase.from("arcade_games").select("*").order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const gameIds = (games ?? []).map((g) => String(g.id));
  const { data: levels } = gameIds.length
    ? await supabase.from("arcade_levels").select("id,game_id").in("game_id", gameIds)
    : { data: [] as any[] };
  const levelCount = new Map<string, number>();
  (levels ?? []).forEach((l: any) => levelCount.set(String(l.game_id), (levelCount.get(String(l.game_id)) ?? 0) + 1));

  return NextResponse.json({
    success: true,
    data: (games ?? []).map((g) => ({ ...g, level_count: levelCount.get(String(g.id)) ?? 0 })),
  });
}
