import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest, orderConversationPair } from "@/lib/supachat/server";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const supabase = getSupaChatAdminClient();
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "1";

  let query = supabase
    .from("supachat_conversations")
    .select("id,participant_1,participant_2,last_message,last_message_at,unread_count_1,unread_count_2,created_at")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order("last_message_at", { ascending: false })
    .limit(200);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const convos = data ?? [];
  const filtered = unreadOnly
    ? convos.filter((c: any) => (c.participant_1 === userId ? c.unread_count_1 : c.unread_count_2) > 0)
    : convos;

  const otherUserIds = [...new Set(filtered.map((c: any) => (c.participant_1 === userId ? c.participant_2 : c.participant_1)))];
  const usersById: Record<string, any> = {};
  if (otherUserIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,username,display_name,avatar_url,last_seen,pi_uid,wallet_address,wallet_verified")
      .in("id", otherUserIds);
    (users ?? []).forEach((u: any) => {
      const { pi_uid, wallet_address, wallet_verified, ...rest } = u;
      const hasPiUid = Boolean((pi_uid ?? "").trim());
      const hasActivatedWallet = Boolean((wallet_address ?? "").trim()) || Boolean(wallet_verified);
      usersById[u.id] = { ...rest, verified: false, can_receive_pi: hasPiUid && hasActivatedWallet };
    });

    const now = new Date().toISOString();
    const { data: badges } = await supabase
      .from("supachat_verified_badges")
      .select("user_id")
      .in("user_id", otherUserIds)
      .gt("expires_at", now);
    (badges ?? []).forEach((b: any) => {
      if (usersById[b.user_id]) usersById[b.user_id].verified = true;
    });
  }

  const response = filtered.map((c: any) => {
    const otherId = c.participant_1 === userId ? c.participant_2 : c.participant_1;
    return {
      ...c,
      other_user: usersById[otherId] ?? null,
      unread_count: c.participant_1 === userId ? c.unread_count_1 : c.unread_count_2,
    };
  });

  return NextResponse.json({ success: true, data: response });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { participantId } = await req.json().catch(() => ({}));
  if (!participantId) {
    return NextResponse.json({ success: false, error: "participantId required" }, { status: 400 });
  }
  if (participantId === userId) {
    return NextResponse.json({ success: false, error: "Cannot chat with yourself" }, { status: 400 });
  }

  const supabase = getSupaChatAdminClient();
  const [p1, p2] = orderConversationPair(userId, String(participantId));

  const { data: existing } = await supabase
    .from("supachat_conversations")
    .select("id,participant_1,participant_2,last_message,last_message_at,unread_count_1,unread_count_2,created_at")
    .eq("participant_1", p1)
    .eq("participant_2", p2)
    .maybeSingle();

  if (existing) return NextResponse.json({ success: true, data: existing });

  const { data, error } = await supabase
    .from("supachat_conversations")
    .insert({
      participant_1: p1,
      participant_2: p2,
      last_message: "",
      last_message_at: new Date().toISOString(),
      unread_count_1: 0,
      unread_count_2: 0,
    })
    .select("id,participant_1,participant_2,last_message,last_message_at,unread_count_1,unread_count_2,created_at")
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
