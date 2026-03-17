import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supachat/server";
import { getActiveSupaChatSanction, moderateMessage } from "@/lib/supachat/moderator";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const sanction = await getActiveSupaChatSanction(userId);
  return NextResponse.json({ success: true, data: { sanctioned: Boolean(sanction), sanction } });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? "").trim();
  const roomId = body.roomId ? String(body.roomId) : undefined;
  const conversationId = body.conversationId ? String(body.conversationId) : undefined;
  if (!content) return NextResponse.json({ success: false, error: "Message cannot be empty" }, { status: 400 });

  const sanction = await getActiveSupaChatSanction(userId);
  if (sanction) {
    return NextResponse.json(
      { success: false, error: "User sanctioned", sanctioned: true, sanction },
      { status: 403 }
    );
  }

  const decision = await moderateMessage(content, userId, { roomId, conversationId });
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
  return NextResponse.json({ success: true, data: { allowed: true } });
}
