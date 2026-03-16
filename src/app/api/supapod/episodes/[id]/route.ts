// GET — episode detail | PATCH — update | POST — increment plays

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("supapod_episodes")
      .select(`
        *,
        podcast:supapod_id ( id, title, cover_url, creator_id, creator:creator_id ( id, username, display_name, avatar_url ) )
      `)
      .eq("id", id)
      .eq("status", "published")
      .single();

    if (error || !data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ success: false }, { status: 401 });
  const payload = verifyToken(auth);
  if (!payload) return NextResponse.json({ success: false }, { status: 401 });

  const body = await req.json();
  const allowed = ["title", "description", "duration_sec", "status"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) { if (body[k] !== undefined) updates[k] = body[k]; }

  try {
    const supabase = await createAdminClient();
    const { data: ep } = await supabase.from("supapod_episodes").select("supapod_id").eq("id", id).single();
    if (!ep) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const { data: podcast } = await supabase.from("supapods").select("creator_id").eq("id", ep.supapod_id).single();
    if (!podcast || podcast.creator_id !== payload.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const { data, error } = await supabase.from("supapod_episodes").update(updates).eq("id", id).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// POST — increment play count (idempotent per session)
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const supabase = await createAdminClient();
    const { data: ep } = await supabase.from("supapod_episodes").select("id, plays, supapod_id").eq("id", id).single();
    if (!ep) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    await supabase.from("supapod_episodes").update({
      plays: (ep.plays ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    const { data: pod } = await supabase.from("supapods").select("total_plays").eq("id", ep.supapod_id).single();
    if (pod) {
      await supabase.from("supapods").update({
        total_plays: (Number(pod.total_plays) || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", ep.supapod_id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
