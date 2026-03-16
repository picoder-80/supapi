// GET — podcast detail | PATCH — update | DELETE — archive

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("supapods")
      .select(`
        *,
        creator:creator_id ( id, username, display_name, avatar_url )
      `)
      .eq("id", id)
      .single();

    if (error || !data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const { data: episodes } = await supabase
      .from("supapod_episodes")
      .select("id, title, description, audio_url, duration_sec, plays, episode_number, published_at")
      .eq("supapod_id", id)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    return NextResponse.json({ success: true, data: { ...data, episodes: episodes ?? [] } });
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
  const allowed = ["title", "description", "cover_url", "category", "status"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) { if (body[k] !== undefined) updates[k] = body[k]; }

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("supapods")
      .update(updates)
      .eq("id", id)
      .eq("creator_id", payload.userId)
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ success: false }, { status: 401 });
  const payload = verifyToken(auth);
  if (!payload) return NextResponse.json({ success: false }, { status: 401 });

  try {
    const supabase = await createAdminClient();
    await supabase.from("supapods").update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id).eq("creator_id", payload.userId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
