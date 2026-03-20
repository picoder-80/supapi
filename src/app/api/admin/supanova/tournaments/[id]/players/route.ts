import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/api/supanova/_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("arcade_tournament_players")
    .select("id,user_id,score,rank,sc_won,joined_at")
    .eq("tournament_id", id)
    .order("score", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const userIds = [...new Set((data ?? []).map((r: any) => String(r.user_id)).filter(Boolean))];
  const { data: users } = userIds.length ? await supabase.from("users").select("id,username,display_name").in("id", userIds) : { data: [] as any[] };
  const userMap = new Map((users ?? []).map((u: any) => [String(u.id), u]));
  return NextResponse.json({
    success: true,
    data: (data ?? []).map((r: any, idx: number) => ({ ...r, rank: r.rank ?? idx + 1, user: userMap.get(String(r.user_id)) ?? null })),
  });
}
