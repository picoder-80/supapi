import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch { return null; }
}

// POST /api/pioneers/groups — create a new Local Pi Chapter
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const location = String(body.location ?? "").trim();
  const cover_emoji = String(body.cover_emoji ?? "🏘️").trim() || "🏘️";
  const is_public = body.is_public !== false;

  if (!name) return NextResponse.json({ success: false, error: "Group name required" }, { status: 400 });

  const { data: group, error } = await supabase
    .from("pioneer_groups")
    .insert({
      name,
      description,
      location,
      cover_emoji,
      created_by: userId,
      is_public,
      member_count: 1,
    })
    .select("id,name,description,location,lat,lng,cover_emoji,member_count,is_public,created_at")
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase
    .from("pioneer_group_members")
    .insert({ group_id: group.id, user_id: userId, role: "admin" });

  return NextResponse.json({ success: true, data: group });
}
