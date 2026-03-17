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

// POST /api/pioneers/groups/[id]/join — join a public group
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: group } = await supabase
    .from("pioneer_groups")
    .select("id,is_public")
    .eq("id", id)
    .maybeSingle();

  if (!group) return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
  if (!group.is_public) return NextResponse.json({ success: false, error: "Group is private" }, { status: 403 });

  const { data: existing } = await supabase
    .from("pioneer_group_members")
    .select("id")
    .eq("group_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return NextResponse.json({ success: true, data: { already_joined: true } });

  const { error } = await supabase
    .from("pioneer_group_members")
    .insert({ group_id: id, user_id: userId, role: "member" });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const { count } = await supabase
    .from("pioneer_group_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", id);
  await supabase.from("pioneer_groups").update({ member_count: count ?? 1 }).eq("id", id);

  return NextResponse.json({ success: true, data: { joined: true } });
}
