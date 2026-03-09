import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const body = await req.json();
  const allowed = ["status","price_pi","stock","title","description"];
  const updates: Record<string,unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) { if (key in body) updates[key] = body[key]; }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.from("listings").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const supabase = await createAdminClient();
  await supabase.from("listings").update({ status: "deleted", updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ success: true });
}