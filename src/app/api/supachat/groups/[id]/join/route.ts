import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupaChatAdminClient();

  const { data: group } = await supabase
    .from("supachat_groups")
    .select("id,is_public,max_members")
    .eq("id", id)
    .maybeSingle();
  if (!group) return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
  if (!group.is_public) return NextResponse.json({ success: false, error: "Group is private" }, { status: 403 });

  const { data: existing } = await supabase
    .from("supachat_group_members")
    .select("id")
    .eq("group_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return NextResponse.json({ success: true, data: { already_joined: true } });

  const { count } = await supabase
    .from("supachat_group_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", id);
  if (Number(count ?? 0) >= Number(group.max_members ?? 100)) {
    return NextResponse.json({ success: false, error: "Group is full" }, { status: 400 });
  }

  const { error } = await supabase
    .from("supachat_group_members")
    .insert({ group_id: id, user_id: userId, role: "member" });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data: { joined: true } });
}
