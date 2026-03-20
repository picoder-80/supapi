import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/api/supanova/_shared";

export async function GET() {
  const { data, error } = await supabase.from("arcade_tournaments").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const gameIds = [...new Set((data ?? []).map((t: any) => String(t.game_id)).filter(Boolean))];
  const { data: games } = gameIds.length ? await supabase.from("arcade_games").select("id,name,icon,slug").in("id", gameIds) : { data: [] as any[] };
  const gameMap = new Map((games ?? []).map((g: any) => [String(g.id), g]));
  return NextResponse.json({ success: true, data: (data ?? []).map((t: any) => ({ ...t, game: gameMap.get(String(t.game_id)) ?? null })) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const payload = {
    game_id: String(body?.game_id ?? ""),
    name: String(body?.name ?? ""),
    description: String(body?.description ?? ""),
    entry_fee_sc: Number(body?.entry_fee_sc ?? 10),
    prize_pool_sc: Number(body?.prize_pool_sc ?? 0),
    platform_cut_pct: Number(body?.platform_cut_pct ?? 20),
    max_players: Number(body?.max_players ?? 100),
    status: String(body?.status ?? "upcoming"),
    starts_at: body?.starts_at ?? null,
    ends_at: body?.ends_at ?? null,
  };
  if (!payload.game_id || !payload.name) return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
  if (!Number.isFinite(payload.entry_fee_sc) || payload.entry_fee_sc < 0) {
    return NextResponse.json({ success: false, error: "Invalid entry_fee_sc" }, { status: 400 });
  }
  if (!Number.isFinite(payload.max_players) || payload.max_players < 2) {
    return NextResponse.json({ success: false, error: "Invalid max_players (min 2)" }, { status: 400 });
  }
  if (!Number.isFinite(payload.platform_cut_pct) || payload.platform_cut_pct < 0 || payload.platform_cut_pct > 90) {
    return NextResponse.json({ success: false, error: "Invalid platform_cut_pct (0-90)" }, { status: 400 });
  }
  if (payload.starts_at && Number.isNaN(Date.parse(String(payload.starts_at)))) {
    return NextResponse.json({ success: false, error: "Invalid starts_at datetime" }, { status: 400 });
  }
  if (payload.ends_at && Number.isNaN(Date.parse(String(payload.ends_at)))) {
    return NextResponse.json({ success: false, error: "Invalid ends_at datetime" }, { status: 400 });
  }
  if (payload.starts_at && payload.ends_at && Date.parse(String(payload.ends_at)) <= Date.parse(String(payload.starts_at))) {
    return NextResponse.json({ success: false, error: "ends_at must be after starts_at" }, { status: 400 });
  }

  const { data: game } = await supabase.from("arcade_games").select("id").eq("id", payload.game_id).maybeSingle();
  if (!game) return NextResponse.json({ success: false, error: "Invalid game_id" }, { status: 400 });

  const { data: duplicateName } = await supabase
    .from("arcade_tournaments")
    .select("id")
    .eq("game_id", payload.game_id)
    .ilike("name", payload.name)
    .in("status", ["upcoming", "live"])
    .limit(1)
    .maybeSingle();
  if (duplicateName) {
    return NextResponse.json({ success: false, error: "An active tournament with this name already exists for this game" }, { status: 409 });
  }

  if (payload.starts_at && payload.ends_at) {
    const { data: overlap } = await supabase
      .from("arcade_tournaments")
      .select("id,starts_at,ends_at")
      .eq("game_id", payload.game_id)
      .in("status", ["upcoming", "live"])
      .not("starts_at", "is", null)
      .not("ends_at", "is", null);
    const s = Date.parse(String(payload.starts_at));
    const e = Date.parse(String(payload.ends_at));
    const hasOverlap = (overlap ?? []).some((row: any) => {
      const os = Date.parse(String(row.starts_at));
      const oe = Date.parse(String(row.ends_at));
      return s < oe && e > os;
    });
    if (hasOverlap) {
      return NextResponse.json({ success: false, error: "Tournament time overlaps with another active tournament for this game" }, { status: 409 });
    }
  }

  const { data, error } = await supabase.from("arcade_tournaments").insert(payload).select("*").single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
