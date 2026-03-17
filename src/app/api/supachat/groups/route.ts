import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const supabase = getSupaChatAdminClient();
  const { data: memberships } = await supabase
    .from("supachat_group_members")
    .select("group_id")
    .eq("user_id", userId);
  const groupIds = (memberships ?? []).map((m: any) => m.group_id);
  if (groupIds.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const { data: groups, error } = await supabase
    .from("supachat_groups")
    .select("id,name,description,created_by,is_public,max_members,created_at")
    .in("id", groupIds)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const memberCounts: Record<string, number> = {};
  const { data: counts } = await supabase
    .from("supachat_group_members")
    .select("group_id")
    .in("group_id", groupIds);
  (counts ?? []).forEach((m: any) => {
    memberCounts[m.group_id] = (memberCounts[m.group_id] ?? 0) + 1;
  });

  const creatorIds = [...new Set((groups ?? []).map((g: any) => g.created_by).filter(Boolean))];
  const creatorsById: Record<string, any> = {};
  if (creatorIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,username,display_name")
      .in("id", creatorIds);
    (users ?? []).forEach((u: any) => (creatorsById[u.id] = u));
  }

  const response = (groups ?? []).map((g: any) => ({
    ...g,
    member_count: memberCounts[g.id] ?? 0,
    creator: creatorsById[g.created_by] ?? null,
  }));
  return NextResponse.json({ success: true, data: response });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ success: false, error: "Group name required" }, { status: 400 });

  const supabase = getSupaChatAdminClient();
  const { data: group, error } = await supabase
    .from("supachat_groups")
    .insert({
      name,
      description: String(body.description ?? ""),
      created_by: userId,
      is_public: body.is_public !== false,
      max_members: Math.min(Math.max(Number(body.max_members ?? 100), 2), 500),
    })
    .select("id,name,description,created_by,is_public,max_members,created_at")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase
    .from("supachat_group_members")
    .insert({ group_id: group.id, user_id: userId, role: "admin" });

  return NextResponse.json({ success: true, data: group });
}
