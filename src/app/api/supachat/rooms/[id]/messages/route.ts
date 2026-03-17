import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";
import { getActiveSupaChatSanction, moderateMessage } from "@/lib/supachat/moderator";

async function ensureRoomAccess(supabase: ReturnType<typeof getSupaChatAdminClient>, roomId: string, userId: string) {
  const { data: room } = await supabase
    .from("supachat_rooms")
    .select("id,type,entry_fee_pi,is_active,moderation_enabled,moderation_sensitivity")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || !room.is_active) return { ok: false, status: 404, error: "Room not found" };

  if (room.type === "paid") {
    const { data: member } = await supabase
      .from("supachat_room_members")
      .select("room_id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) {
      const { data: entry } = await supabase
        .from("supachat_room_entries")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!entry) return { ok: false, status: 402, error: "Paid room entry required", room };
      await supabase
        .from("supachat_room_members")
        .upsert({ room_id: roomId, user_id: userId, role: "member" }, { onConflict: "room_id,user_id" });
    }
  } else {
    await supabase
      .from("supachat_room_members")
      .upsert({ room_id: roomId, user_id: userId, role: "member" }, { onConflict: "room_id,user_id" });
  }

  return { ok: true, room };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = getSupaChatAdminClient();

  const access = await ensureRoomAccess(supabase, id, userId);
  if (!access.ok) return NextResponse.json({ success: false, error: access.error, room: (access as any).room }, { status: access.status });

  const { data: messages, error } = await supabase
    .from("supachat_room_messages")
    .select("id,room_id,sender_id,content,type,metadata,created_at")
    .eq("room_id", id)
    .order("created_at", { ascending: true })
    .limit(700);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const nowIso = new Date().toISOString();
  const { data: sponsored } = await supabase
    .from("supachat_sponsored_messages")
    .select("id,content,listing_id,interval_messages,starts_at,ends_at")
    .eq("room_id", id)
    .eq("is_active", true)
    .lte("starts_at", nowIso)
    .gte("ends_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(5);

  let enrichedMessages = [...(messages ?? [])];
  if (sponsored && sponsored.length > 0 && enrichedMessages.length > 0) {
    const interval = Math.max(Number(sponsored[0].interval_messages ?? 50), 10);
    const withSponsored: any[] = [];
    enrichedMessages.forEach((msg, idx) => {
      withSponsored.push(msg);
      if ((idx + 1) % interval === 0) {
        const ad = sponsored[idx % sponsored.length];
        withSponsored.push({
          id: `sponsored-${ad.id}-${idx}`,
          room_id: id,
          sender_id: null,
          content: ad.content,
          type: "sponsored",
          metadata: { sponsored_id: ad.id, listing_id: ad.listing_id },
          created_at: msg.created_at,
        });
      }
    });
    enrichedMessages = withSponsored;
  }

  const userIds = [...new Set(enrichedMessages.map((m: any) => m.sender_id).filter(Boolean))];
  const usersById: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,username,display_name,avatar_url")
      .in("id", userIds);
    (users ?? []).forEach((u: any) => (usersById[u.id] = u));
  }

  const { data: members } = await supabase
    .from("supachat_room_members")
    .select("user_id,role,joined_at")
    .eq("room_id", id)
    .order("joined_at", { ascending: false })
    .limit(200);

  return NextResponse.json({
    success: true,
    data: {
      messages: enrichedMessages.map((m: any) => ({ ...m, sender: usersById[m.sender_id] ?? null })),
      members: members ?? [],
    },
    sanction: await getActiveSupaChatSanction(userId),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = getSupaChatAdminClient();

  const access = await ensureRoomAccess(supabase, id, userId);
  if (!access.ok) return NextResponse.json({ success: false, error: access.error, room: (access as any).room }, { status: access.status });

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

  const roomMeta = (access as any).room ?? {};
  if (type === "text" && roomMeta.moderation_enabled !== false) {
    const decision = await moderateMessage(content, userId, { roomId: id });
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
    .from("supachat_room_messages")
    .insert({
      room_id: id,
      sender_id: userId,
      content,
      type,
      metadata,
    })
    .select("id,room_id,sender_id,content,type,metadata,created_at")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data: message });
}
