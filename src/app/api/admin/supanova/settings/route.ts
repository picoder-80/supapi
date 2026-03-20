import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader, supabase } from "@/app/api/supanova/_shared";

export async function GET() {
  const { data, error } = await supabase
    .from("arcade_commission_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(req: NextRequest) {
  const changedBy = getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!changedBy) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const gamePlay = Number(body?.game_play_cut_pct);
  const levelUnlock = Number(body?.level_unlock_cut_pct);
  const tournament = Number(body?.tournament_cut_pct);
  const dailyLimit = Number(body?.daily_earn_limit_sc);

  const validPct = [gamePlay, levelUnlock, tournament].every((v) => Number.isFinite(v) && v >= 1 && v <= 90);
  if (!validPct || !Number.isFinite(dailyLimit) || dailyLimit < 10) {
    return NextResponse.json({ success: false, error: "Invalid settings input" }, { status: 400 });
  }

  const { data: current } = await supabase
    .from("arcade_commission_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!current) {
    const { data: inserted, error } = await supabase.from("arcade_commission_settings").insert({
      game_play_cut_pct: gamePlay,
      level_unlock_cut_pct: levelUnlock,
      tournament_cut_pct: tournament,
      daily_earn_limit_sc: dailyLimit,
      updated_by: changedBy,
      updated_at: new Date().toISOString(),
    }).select("*").single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, settings: inserted });
  }

  const { data: updated, error } = await supabase
    .from("arcade_commission_settings")
    .update({
      game_play_cut_pct: gamePlay,
      level_unlock_cut_pct: levelUnlock,
      tournament_cut_pct: tournament,
      daily_earn_limit_sc: dailyLimit,
      updated_by: changedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from("arcade_commission_audit").insert({
    changed_by: changedBy,
    old_game_play_cut: current.game_play_cut_pct,
    new_game_play_cut: gamePlay,
    old_tournament_cut: current.tournament_cut_pct,
    new_tournament_cut: tournament,
    old_level_unlock_cut: current.level_unlock_cut_pct,
    new_level_unlock_cut: levelUnlock,
    note: String(body?.note ?? "Manual settings update"),
  });

  return NextResponse.json({ success: true, settings: updated });
}
