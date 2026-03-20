import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

function normalizeStatusForUi(status: unknown): string {
  const raw = String(status ?? "");
  if (raw === "removed") return "deleted";
  return raw;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createAdminClient();

    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    const payload = auth ? verifyToken(auth) : null;

    const { data, error } = await supabase
      .from("classified_listings")
      .select(`*, seller:seller_id ( id, username, display_name, avatar_url, kyc_status, created_at )`)
      .eq("id", id)
      .single();

    if (error || !data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const sellerId = String((data as { seller_id?: string }).seller_id ?? "");
    const isOwner = Boolean(payload?.userId && payload.userId === sellerId);
    if (data.status !== "active" && !isOwner) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    if (data.status === "active") {
      try {
        await supabase.rpc("increment_classified_views", { p_id: id });
      } catch {
        /* best-effort */
      }
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const allowed = [
      "title",
      "description",
      "price_display",
      "category",
      "subcategory",
      "category_deep",
      "images",
      "location",
      "status",
      "country_code",
      "contact_phone",
      "contact_whatsapp",
    ];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("classified_listings")
      .update(updates)
      .eq("id", id)
      .eq("seller_id", payload.userId)
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ success: false, error: "Not found or unauthorized" }, { status: 404 });

    return NextResponse.json({
      success: true,
      data: { ...data, status: normalizeStatusForUi(data.status) },
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true" || searchParams.get("permanent") === "1";

    const supabase = await createAdminClient();

    if (permanent) {
      const { data: row } = await supabase
        .from("classified_listings")
        .select("id, status, seller_id")
        .eq("id", id)
        .eq("seller_id", payload.userId)
        .single();

      if (!row) return NextResponse.json({ success: false, error: "Not found or unauthorized" }, { status: 404 });
      if (!["removed", "deleted"].includes(String(row.status))) {
        return NextResponse.json(
          { success: false, error: "Only archived ads can be permanently deleted" },
          { status: 400 }
        );
      }

      const { error } = await supabase.from("classified_listings").delete().eq("id", id).eq("seller_id", payload.userId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    for (const status of ["deleted", "removed"] as const) {
      const { error } = await supabase
        .from("classified_listings")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("seller_id", payload.userId);
      if (!error) return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Delete failed" }, { status: 500 });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
