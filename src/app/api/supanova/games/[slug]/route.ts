import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../_shared";

type Params = { params: Promise<{ slug: string }> };

function buildDefaultLevels(game: any) {
  const freeLevels = Math.max(0, Number(game?.free_levels ?? 0));
  const baseCost = Math.max(1, Number(game?.cost_sc ?? 5));
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= 10; i += 1) {
    const isFree = game?.is_free && i <= freeLevels;
    rows.push({
      game_id: game.id,
      level_number: i,
      name: `Level ${i}`,
      difficulty: i <= 3 ? "easy" : i <= 6 ? "medium" : i <= 8 ? "hard" : "expert",
      is_free: Boolean(isFree),
      cost_sc: isFree ? 0 : baseCost + Math.max(0, i - freeLevels - 1),
      reward_sc: 10 + i * 2,
      time_limit_seconds: 60,
      questions: [],
    });
  }
  return rows;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const { data: game, error } = await supabase
    .from("arcade_games")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  if (error || !game) return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 });

  let { data: levels } = await supabase
    .from("arcade_levels")
    .select("*")
    .eq("game_id", game.id)
    .order("level_number", { ascending: true });

  if (!levels || levels.length === 0) {
    const defaults = buildDefaultLevels(game);
    await supabase.from("arcade_levels").insert(defaults);
    const reloaded = await supabase
      .from("arcade_levels")
      .select("*")
      .eq("game_id", game.id)
      .order("level_number", { ascending: true });
    levels = reloaded.data ?? [];
  }

  return NextResponse.json({ success: true, data: { game, levels: levels ?? [] } });
}
