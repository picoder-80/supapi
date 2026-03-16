// GET — creator's own podcasts

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ success: false }, { status: 401 });
  const payload = verifyToken(auth);
  if (!payload) return NextResponse.json({ success: false }, { status: 401 });

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("supapods")
      .select("id, title, description, cover_url, category, total_plays, total_episodes, status, created_at")
      .eq("creator_id", payload.userId)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
