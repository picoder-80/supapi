import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest, orderConversationPair } from "@/lib/supachat/server";

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { receiverId } = await req.json().catch(() => ({}));
  if (!receiverId) return NextResponse.json({ success: false, error: "receiverId required" }, { status: 400 });
  if (receiverId === userId) return NextResponse.json({ success: false, error: "Cannot DM yourself" }, { status: 400 });

  const [p1, p2] = orderConversationPair(userId, String(receiverId));
  const supabase = getSupaChatAdminClient();

  const { data: existing } = await supabase
    .from("supachat_conversations")
    .select("id")
    .eq("participant_1", p1)
    .eq("participant_2", p2)
    .maybeSingle();
  if (existing?.id) return NextResponse.json({ success: true, data: { conversationId: existing.id } });

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
    .select("id")
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: { conversationId: data.id } });
}
