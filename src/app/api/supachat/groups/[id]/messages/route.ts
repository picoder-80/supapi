import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";
import { getActiveSupaChatSanction, moderateMessage } from "@/lib/supachat/moderator";

async function ensureGroupAccess(
  supabase: ReturnType<typeof getSupaChatAdminClient>,
  groupId: string,
  userId: string
) {
  const { data: group } = await supabase
    .from("supachat_groups")
    .select("id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return { ok: false, status: 404, error: "Group not found" };

  const { data: member } = await supabase
    .from("supachat_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return { ok: false, status: 403, error: "Not a member of this group" };

  return { ok: true };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupaChatAdminClient();

  const access = await ensureGroupAccess(supabase, id, userId);
  if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status });

  const { data: messages, error } = await supabase
    .from("supachat_group_messages")
    .select("id,group_id,sender_id,content,type,metadata,created_at")
    .eq("group_id", id)
    .order("created_at", { ascending: true })
    .limit(700);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const userIds = [...new Set((messages ?? []).map((m: any) => m.sender_id).filter(Boolean))];
  const usersById: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,username,display_name,avatar_url")
      .in("id", userIds);
    (users ?? []).forEach((u: any) => (usersById[u.id] = u));
  }

  const { data: members } = await supabase
    .from("supachat_group_members")
    .select("user_id,role,joined_at")
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  return NextResponse.json({
    success: true,
    data: {
      messages: (messages ?? []).map((m: any) => ({ ...m, sender: usersById[m.sender_id] ?? null })),
      members: members ?? [],
    },
    sanction: await getActiveSupaChatSanction(userId),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupaChatAdminClient();

  const access = await ensureGroupAccess(supabase, id, userId);
  if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? "").trim();
  const type = String(body.type ?? "text");
  const metadata = body.metadata ?? {};
  if (!content) return NextResponse.json({ success: false, error: "Message cannot be empty" }, { status: 400 });

  const activeSanction = await getActiveSupaChatSanction(userId);
  if (activeSanction) {
    return NextResponse.json(
      {
        success: false,
        error: "User sanctioned",
        sanctioned: true,
        sanction: activeSanction,
      },
      { status: 403 }
    );
  }

  if (type === "text") {
    const decision = await moderateMessage(content, userId, { groupId: id });
    if (!decision.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Message removed by AI moderator",
          moderation: true,
          category: decision.category ?? "other",
          sanction: decision.sanction ?? "deleted_only",
        },
        { status: 400 }
      );
    }
  }

  const { data: message, error } = await supabase
    .from("supachat_group_messages")
    .insert({
      group_id: id,
      sender_id: userId,
      content,
      type,
      metadata,
    })
    .select("id,group_id,sender_id,content,type,metadata,created_at")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data: message });
}
