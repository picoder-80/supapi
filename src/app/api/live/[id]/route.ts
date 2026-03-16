// GET /api/live/[id] — get a single live session

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false }, { status: 400 });

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("live_sessions")
      .select(`
        id,
        user_id,
        title,
        stream_url,
        status,
        viewer_count,
        started_at,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false }, { status: 404 });
    }

    const session = {
      id: data.id,
      user_id: data.user_id,
      title: data.title,
      stream_url: data.stream_url,
      status: data.status,
      viewer_count: data.viewer_count ?? 0,
      started_at: data.started_at,
      user: Array.isArray(data.user) ? data.user[0] : data.user,
    };

    return NextResponse.json({ success: true, data: session });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
