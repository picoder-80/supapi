import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/api/supanova/_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data, error } = await supabase.from("arcade_levels").select("*").eq("game_id", id).order("level_number", { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const rows = (data ?? []).map((l: any) => ({ ...l, question_count: Array.isArray(l.questions) ? l.questions.length : 0 }));
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const payload = {
    game_id: id,
    level_number: Number(body?.level_number ?? 1),
    name: String(body?.name ?? ""),
    difficulty: String(body?.difficulty ?? "easy"),
    is_free: Boolean(body?.is_free),
    cost_sc: Number(body?.cost_sc ?? 5),
    reward_sc: Number(body?.reward_sc ?? 10),
    time_limit_seconds: Number(body?.time_limit_seconds ?? 60),
    questions: Array.isArray(body?.questions) ? body.questions : [],
  };
  const { data, error } = await supabase.from("arcade_levels").insert(payload).select("*").single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
