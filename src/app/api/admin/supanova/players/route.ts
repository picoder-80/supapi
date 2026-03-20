import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/api/supanova/_shared";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").toLowerCase();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(10, Number(searchParams.get("pageSize") ?? 20)));

  const { data: users, error: userErr } = await supabase.from("users").select("id,username,display_name");
  if (userErr) return NextResponse.json({ success: false, error: userErr.message }, { status: 500 });
  const selectedUsers = (users ?? []).filter((u: any) => {
    if (!q) return true;
    const label = `${u.username ?? ""} ${u.display_name ?? ""}`.toLowerCase();
    return label.includes(q);
  });

  const userIds = selectedUsers.map((u: any) => String(u.id));
  const [{ data: sessions }, { data: boards }, { data: games }] = await Promise.all([
    userIds.length ? supabase.from("arcade_sessions").select("*").in("user_id", userIds) : Promise.resolve({ data: [] as any[] } as any),
    userIds.length ? supabase.from("arcade_leaderboard").select("*").in("user_id", userIds) : Promise.resolve({ data: [] as any[] } as any),
    supabase.from("arcade_games").select("id,name"),
  ]);
  const gameMap = new Map((games ?? []).map((g: any) => [String(g.id), String(g.name)]));

  const rows = selectedUsers.map((u: any) => {
    const s = (sessions ?? []).filter((x: any) => String(x.user_id) === String(u.id));
    const b = (boards ?? []).filter((x: any) => String(x.user_id) === String(u.id));
    const totalPlays = s.length;
    const spent = s.reduce((sum: number, x: any) => sum + Number(x.sc_spent ?? 0), 0);
    const earned = s.reduce((sum: number, x: any) => sum + Number(x.sc_earned ?? 0), 0);
    const favMap = new Map<string, number>();
    s.forEach((x: any) => favMap.set(String(x.game_id), (favMap.get(String(x.game_id)) ?? 0) + 1));
    const fav = [...favMap.entries()].sort((a, b2) => b2[1] - a[1])[0]?.[0];
    const lastPlayed = [...s].sort((a: any, b2: any) => String(b2.completed_at ?? "").localeCompare(String(a.completed_at ?? "")))[0]?.completed_at ?? null;
    return {
      user_id: u.id,
      username: u.display_name || u.username || "Unknown",
      total_plays: totalPlays,
      total_sc_spent: Number(spent.toFixed(4)),
      total_sc_earned: Number(earned.toFixed(4)),
      favourite_game: fav ? gameMap.get(fav) : "-",
      last_played: lastPlayed,
      best_scores: b,
    };
  });

  rows.sort((a, b) => b.total_sc_earned - a.total_sc_earned);
  const paged = rows.slice((page - 1) * pageSize, page * pageSize).map((r, idx) => ({ rank: (page - 1) * pageSize + idx + 1, ...r }));
  return NextResponse.json({ success: true, data: paged, total: rows.length, page, pageSize });
}
