import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const supabase = getSupaChatAdminClient();
  const { data: myMemberships } = await supabase
    .from("supachat_group_members")
    .select("group_id")
    .eq("user_id", userId);
  const myGroupIds = new Set((myMemberships ?? []).map((m: any) => m.group_id));

  const { data: groups, error } = await supabase
    .from("supachat_groups")
    .select("id,name,description,created_by,is_public,max_members,created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const discoverable = (groups ?? []).filter((g: any) => !myGroupIds.has(g.id));

  const memberCounts: Record<string, number> = {};
  const groupIds = discoverable.map((g: any) => g.id);
  if (groupIds.length > 0) {
    const { data: counts } = await supabase
      .from("supachat_group_members")
      .select("group_id")
      .in("group_id", groupIds);
    (counts ?? []).forEach((m: any) => {
      memberCounts[m.group_id] = (memberCounts[m.group_id] ?? 0) + 1;
    });
  }

  const creatorIds = [...new Set(discoverable.map((g: any) => g.created_by).filter(Boolean))];
  const creatorsById: Record<string, any> = {};
  if (creatorIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,username,display_name")
      .in("id", creatorIds);
    (users ?? []).forEach((u: any) => (creatorsById[u.id] = u));
  }

  const response = discoverable.map((g: any) => ({
    ...g,
    member_count: memberCounts[g.id] ?? 0,
    creator: creatorsById[g.created_by] ?? null,
  }));
  return NextResponse.json({ success: true, data: response });
}
