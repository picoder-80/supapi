import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/api/supanova/_shared";

type Params = { params: Promise<{ id: string; levelId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, levelId } = await params;
  const body = await req.json().catch(() => ({}));
  const allowed = ["level_number", "name", "difficulty", "is_free", "cost_sc", "reward_sc", "time_limit_seconds", "questions"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];
  const { data, error } = await supabase
    .from("arcade_levels")
    .update(updates)
    .eq("id", levelId)
    .eq("game_id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
