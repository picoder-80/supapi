// PATCH /api/newsfeed/status/[id] — edit (owner only)
// DELETE /api/newsfeed/status/[id] — delete (owner only)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = auth ? verifyToken(auth) : null;
    if (!payload?.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const body = await req.json();
    const text = (body?.body ?? "").toString().trim();
    if (!text || text.length > 500) return NextResponse.json({ success: false, error: "Body required (max 500 chars)" }, { status: 400 });

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("status_posts")
      .update({ body: text })
      .eq("id", id)
      .eq("user_id", payload.userId)
      .select("id, body, created_at")
      .single();

    if (error || !data) return NextResponse.json({ success: false, error: "Not found or forbidden" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = auth ? verifyToken(auth) : null;
    if (!payload?.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const supabase = await createAdminClient();
    const { error } = await supabase
      .from("status_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", payload.userId);

    if (error) return NextResponse.json({ success: false, error: "Not found or forbidden" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
