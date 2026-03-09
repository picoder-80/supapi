import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// POST — upload listing image (max 5 per listing)
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const formData = await req.formData();
    const file      = formData.get("image") as File | null;
    const listingId = formData.get("listing_id") as string | null;
    const index     = formData.get("index") as string | null; // 0-4

    if (!file) return NextResponse.json({ success: false, error: "No file" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ success: false, error: "Must be image" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ success: false, error: "Max 5MB per image" }, { status: 400 });

    const supabase = await createAdminClient();
    const ext  = file.name.split(".").pop() ?? "jpg";
    const folder = listingId ?? `draft_${payload.userId}`;
    const path = `${payload.userId}/${folder}/${index ?? Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("listings")
      .upload(path, bytes, { contentType: file.type, upsert: true });

    if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from("listings").getPublicUrl(path);
    return NextResponse.json({ success: true, data: { url: publicUrl, path } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
