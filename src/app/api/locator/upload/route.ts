import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUser(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
  } catch { return null; }
}

export async function POST(req: Request) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ success: false, error: "No file" }, { status: 400 });

    // Max 2MB
    

    const ext      = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filename = `${user.userId}-${Date.now()}.${ext}`;
    const path     = `locator/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    const { error } = await supabase.storage
      .from("business-images")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const { data: urlData } = supabase.storage
      .from("business-images")
      .getPublicUrl(path);

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}