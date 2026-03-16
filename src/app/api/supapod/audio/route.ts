// POST — upload podcast episode audio
// Bucket: supapod-audio (create in Supabase Storage if missing)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

const MAX_SIZE_MB = 100; // 100MB per episode
const ALLOWED_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/x-m4a"];

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("audio") as File | null;
    const podcastId = formData.get("podcast_id") as string | null;
    const episodeId = formData.get("episode_id") as string | null;

    if (!file) return NextResponse.json({ success: false, error: "No audio file" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a|webm)$/i)) {
      return NextResponse.json({ success: false, error: "Invalid audio format (mp3, wav, ogg, m4a)" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ success: false, error: `Max ${MAX_SIZE_MB}MB per file` }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
    const folder = podcastId ?? `draft_${payload.userId}`;
    const path = `${payload.userId}/${folder}/${episodeId ?? Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("supapod-audio")
      .upload(path, bytes, { contentType: file.type || "audio/mpeg", upsert: true });

    if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from("supapod-audio").getPublicUrl(path);
    return NextResponse.json({
      success: true,
      data: { url: publicUrl, path, size: file.size, type: file.type },
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
