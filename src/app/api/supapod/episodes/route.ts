// POST — create episode (requires podcast_id, audio_url)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ success: false }, { status: 401 });
  const payload = verifyToken(auth);
  if (!payload) return NextResponse.json({ success: false }, { status: 401 });

  const body = await req.json();
  const { podcast_id, title, description, audio_url, duration_sec, episode_number } = body;
  if (!podcast_id || !title?.trim() || !audio_url) {
    return NextResponse.json({ success: false, error: "podcast_id, title, audio_url required" }, { status: 400 });
  }

  try {
    const supabase = await createAdminClient();
    const { data: podcast } = await supabase.from("supapods").select("id, creator_id, total_episodes").eq("id", podcast_id).single();
    if (!podcast || podcast.creator_id !== payload.userId) {
      return NextResponse.json({ success: false, error: "Podcast not found or unauthorized" }, { status: 404 });
    }

    const { data: ep, error } = await supabase
      .from("supapod_episodes")
      .insert({
        supapod_id: podcast_id,
        title: title.trim(),
        description: description?.trim() ?? "",
        audio_url,
        duration_sec: duration_sec ?? 0,
        episode_number: episode_number ?? null,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const nextCount = (Number((podcast as { total_episodes?: number }).total_episodes) || 0) + 1;
    await supabase.from("supapods").update({
      total_episodes: nextCount,
      updated_at: new Date().toISOString(),
    }).eq("id", podcast_id);

    return NextResponse.json({ success: true, data: ep });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
