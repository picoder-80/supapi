import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";
import { getActiveSupaChatSanction, moderateMessage } from "@/lib/supachat/moderator";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = getSupaChatAdminClient();

  const { data: convo } = await supabase
    .from("supachat_conversations")
    .select("id,participant_1,participant_2,unread_count_1,unread_count_2")
    .eq("id", id)
    .maybeSingle();
  if (!convo) return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
  if (convo.participant_1 !== userId && convo.participant_2 !== userId) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: messages, error } = await supabase
    .from("supachat_messages")
    .select("id,conversation_id,sender_id,content,type,metadata,is_read,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Mark inbound as read and clear unread counter for current user.
  await supabase
    .from("supachat_messages")
    .update({ is_read: true })
    .eq("conversation_id", id)
    .neq("sender_id", userId)
    .eq("is_read", false);
  await supabase
    .from("supachat_conversations")
    .update({
      unread_count_1: convo.participant_1 === userId ? 0 : (convo as any).unread_count_1,
      unread_count_2: convo.participant_2 === userId ? 0 : (convo as any).unread_count_2,
    })
    .eq("id", id);

  const userIds = [...new Set((messages ?? []).map((m: any) => m.sender_id))];
  const usersById: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,username,display_name,avatar_url")
      .in("id", userIds);
    (users ?? []).forEach((u: any) => (usersById[u.id] = u));
  }

  return NextResponse.json({
    success: true,
    data: (messages ?? []).map((m: any) => ({ ...m, sender: usersById[m.sender_id] ?? null })),
    sanction: await getActiveSupaChatSanction(userId),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = getSupaChatAdminClient();

  const { data: convo } = await supabase
    .from("supachat_conversations")
    .select("id,participant_1,participant_2,unread_count_1,unread_count_2")
    .eq("id", id)
    .maybeSingle();
  if (!convo) return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
  if (convo.participant_1 !== userId && convo.participant_2 !== userId) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

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
    const decision = await moderateMessage(content, userId, { conversationId: id });
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
    .from("supachat_messages")
    .insert({
      conversation_id: id,
      sender_id: userId,
      content,
      type,
      metadata,
      is_read: false,
    })
    .select("id,conversation_id,sender_id,content,type,metadata,is_read,created_at")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const nextUnread1 = convo.participant_1 === userId ? convo.unread_count_1 : convo.unread_count_1 + 1;
  const nextUnread2 = convo.participant_2 === userId ? convo.unread_count_2 : convo.unread_count_2 + 1;
  await supabase
    .from("supachat_conversations")
    .update({
      last_message: content.slice(0, 500),
      last_message_at: new Date().toISOString(),
      unread_count_1: nextUnread1,
      unread_count_2: nextUnread2,
    })
    .eq("id", id);

  const receiverId = convo.participant_1 === userId ? convo.participant_2 : convo.participant_1;
  const { data: sender } = await supabase
    .from("users")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  await supabase.from("notifications").upsert(
    {
      user_id: receiverId,
      title: `New message from ${sender?.username ?? "Pioneer"}`,
      message: content.slice(0, 160),
      link: `/supachat/dm/${id}`,
      type: "supachat_dm",
      dedupe_key: `supachat-dm-msg-${message.id}`,
      metadata: { conversation_id: id, message_id: message.id, sender_id: userId },
    },
    { onConflict: "dedupe_key" }
  );

  return NextResponse.json({ success: true, data: message });
}
