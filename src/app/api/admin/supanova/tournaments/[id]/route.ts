import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/api/supanova/_shared";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { data: current, error: currentErr } = await supabase.from("arcade_tournaments").select("*").eq("id", id).single();
  if (currentErr || !current) return NextResponse.json({ success: false, error: "Tournament not found" }, { status: 404 });

  const nextStatus = body?.status ? String(body.status) : String(current.status);
  if (!["cancelled", "upcoming", "live", "completed"].includes(nextStatus)) {
    return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
  }

  const statusRules: Record<string, string[]> = {
    upcoming: ["live", "cancelled", "upcoming"],
    live: ["completed", "cancelled", "live"],
    completed: ["completed"],
    cancelled: ["cancelled"],
  };
  const allowed = statusRules[String(current.status)] ?? [String(current.status)];
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json({ success: false, error: `Invalid status transition: ${current.status} -> ${nextStatus}` }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status: nextStatus };
  if ("name" in body) updates.name = String(body.name ?? "").trim();
  if ("description" in body) updates.description = String(body.description ?? "");
  if ("entry_fee_sc" in body) {
    const entry = Number(body.entry_fee_sc);
    if (!Number.isFinite(entry) || entry < 0) return NextResponse.json({ success: false, error: "Invalid entry_fee_sc" }, { status: 400 });
    updates.entry_fee_sc = entry;
  }
  if ("max_players" in body) {
    const maxPlayers = Number(body.max_players);
    if (!Number.isFinite(maxPlayers) || maxPlayers < Number(current.current_players ?? 0)) {
      return NextResponse.json({ success: false, error: "max_players cannot be lower than current_players" }, { status: 400 });
    }
    updates.max_players = Math.floor(maxPlayers);
  }
  if ("platform_cut_pct" in body) {
    const pct = Number(body.platform_cut_pct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) return NextResponse.json({ success: false, error: "Invalid platform_cut_pct" }, { status: 400 });
    updates.platform_cut_pct = pct;
  }
  if ("starts_at" in body) updates.starts_at = body.starts_at || null;
  if ("ends_at" in body) updates.ends_at = body.ends_at || null;

  const { data, error } = await supabase
    .from("arcade_tournaments")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
