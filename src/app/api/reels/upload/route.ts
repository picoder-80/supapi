import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// App Router: multipart handled via req.formData(); Pages `config` is not supported here.
export const maxDuration = 60;

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const BUCKET = "reels"; // dedicated reels bucket

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("video") as File | null;
    if (!file) return NextResponse.json({ success: false, error: "No video file" }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ success: false, error: "Use MP4, WebM or MOV" }, { status: 400 });
    if (file.size > MAX_VIDEO_SIZE)
      return NextResponse.json({ success: false, error: "Max 50MB" }, { status: 400 });

    const supabase = await createAdminClient();

    // Ensure reels bucket exists, create if not
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = (buckets ?? []).some((b: { name: string }) => b.name === BUCKET);
    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_VIDEO_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
    const path = `${payload.userId}/${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });

    if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ success: true, data: { url: publicUrl, path } });
  } catch (err) {
    console.error("[Reels Upload]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
