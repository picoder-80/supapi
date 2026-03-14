import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/security/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const status = String(body?.status ?? "");
    if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status, updated_at")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    if (auth.userId) {
      await logAdminAction({
        adminUserId: auth.userId,
        action: "support_ticket_status_update",
        targetType: "support_ticket",
        targetId: id,
        detail: { status },
      });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
