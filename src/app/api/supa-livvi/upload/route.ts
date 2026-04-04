// POST — upload one SupaLivvi post image (public URL for feed)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId?: string;
      id?: string;
      sub?: string;
    };
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { success: false, error: "Use JPG, PNG, WebP, or GIF" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: "Max 5MB per image" }, { status: 400 });
  }

  const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ext = ["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt) ? rawExt : "jpg";
  const path = `supa-livvi/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from("listings").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const {
    data: { publicUrl },
  } = supabase.storage.from("listings").getPublicUrl(path);

  return NextResponse.json({ success: true, url: publicUrl });
}
