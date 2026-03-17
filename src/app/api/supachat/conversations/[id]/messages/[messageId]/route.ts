import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id: conversationId, messageId } = await params;
  const supabase = getSupaChatAdminClient();

  const { data: convo } = await supabase
    .from("supachat_conversations")
    .select("id, participant_1, participant_2")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
  if (convo.participant_1 !== userId && convo.participant_2 !== userId) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: msg } = await supabase
    .from("supachat_messages")
    .select("id, sender_id")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 });

  if (msg.sender_id !== userId) {
    return NextResponse.json({ success: false, error: "You can only delete your own messages" }, { status: 403 });
  }

  const { error } = await supabase
    .from("supachat_messages")
    .delete()
    .eq("id", messageId)
    .eq("conversation_id", conversationId);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
