import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader, spendSC, supabase } from "../_shared";

export async function POST(req: NextRequest) {
  const userId = getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const gameSlug = String(body?.gameSlug ?? "");
  const levelId = String(body?.levelId ?? "");
  if (!gameSlug || !levelId) return NextResponse.json({ success: false, error: "Missing input" }, { status: 400 });

  const { data: game } = await supabase.from("arcade_games").select("*").eq("slug", gameSlug).single();
  const { data: level } = await supabase.from("arcade_levels").select("*").eq("id", levelId).single();
  if (!game || !level) return NextResponse.json({ success: false, error: "Invalid game or level" }, { status: 404 });

  const levelCost = Number(level.cost_sc ?? 0);
  const scSpent = level.is_free ? 0 : levelCost;
  if (scSpent > 0) {
    const spent = await spendSC(userId, scSpent, "arcade_play_start", `🎮 Start ${game.name} L${level.level_number}`);
    if (!spent.ok) return NextResponse.json({ success: false, error: `Not enough SC. Need ${scSpent} SC` }, { status: 400 });
  }

  const { data: session, error } = await supabase
    .from("arcade_sessions")
    .insert({
      user_id: userId,
      game_id: game.id,
      level_id: level.id,
      sc_spent: scSpent,
      status: "active",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !session) return NextResponse.json({ success: false, error: error?.message ?? "Failed to start session" }, { status: 500 });
  return NextResponse.json({ success: true, data: { sessionId: session.id } });
}
