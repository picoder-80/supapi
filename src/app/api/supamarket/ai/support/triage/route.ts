import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { triageSupport } from "@/lib/market/ai";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const message = String(body?.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ success: false, error: "message is required" }, { status: 400 });
    }

    const result = await triageSupport({
      message,
      order_status: body?.order_status ?? null,
    });

    // Best-effort ticket logging (works if support_tickets table exists)
    let ticketId: string | null = null;
    try {
      const supabase = await createAdminClient();
      const { data: ticket } = await supabase
        .from("support_tickets")
        .insert({
          user_id: payload.userId,
          order_id: body?.order_id ?? null,
          message,
          category: result.category,
          priority: result.priority,
          ai_reply: result.suggested_reply,
          ai_actions: result.recommended_actions,
          status: "open",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      ticketId = ticket?.id ?? null;
    } catch {
      ticketId = null;
    }

    return NextResponse.json({
      success: true,
      data: {
        user_id: payload.userId,
        ticket_id: ticketId,
        ...result,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
