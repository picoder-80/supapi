import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupaChatAdminClient();

  const { data: group, error } = await supabase
    .from("supachat_groups")
    .select("id,name,description,created_by,is_public,max_members,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !group) return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });

  const { data: member } = await supabase
    .from("supachat_group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member && !group.is_public) {
    return NextResponse.json({ success: false, error: "Group is private" }, { status: 403 });
  }

  const { data: members } = await supabase
    .from("supachat_group_members")
    .select("user_id,role,joined_at")
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  const userIds = [...new Set((members ?? []).map((m: any) => m.user_id).filter(Boolean))];
  const usersById: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,username,display_name,avatar_url")
      .in("id", userIds);
    (users ?? []).forEach((u: any) => (usersById[u.id] = u));
  }

  const enrichedMembers = (members ?? []).map((m: any) => ({
    ...m,
    user: usersById[m.user_id] ?? null,
  }));

  return NextResponse.json({
    success: true,
    data: {
      ...group,
      members: enrichedMembers,
      is_member: !!member,
      my_role: member?.role ?? null,
    },
  });
}
