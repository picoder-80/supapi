import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;
    if (!file) return NextResponse.json({ success: false, error: "No file" }, { status: 400 });

    // Validate type and size
    if (!file.type.startsWith("image/")) return NextResponse.json({ success: false, error: "Must be an image" }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ success: false, error: "Max 2MB" }, { status: 400 });

    const supabase = await createAdminClient();
    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `${payload.userId}/avatar.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, bytes, { contentType: file.type, upsert: true });

    if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

    // Save URL to user record
    const { data, error } = await supabase
      .from("users")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", payload.userId)
      .select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: { user: data, avatar_url: publicUrl } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}