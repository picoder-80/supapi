import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

function normalizeListingStatusForUi(status: unknown): string {
  const raw = String(status ?? "");
  if (raw === "removed") return "deleted";
  return raw;
}

function fallbackStatuses(requested: string): string[] {
  if (requested === "paused") return ["paused", "removed"];
  if (requested === "deleted") return ["deleted", "removed"];
  return [requested];
}

// GET — single listing detail (optionally includes liked when Authorization present)
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createAdminClient();

    // Increment view count (best-effort)
    try { await supabase.rpc("increment_listing_views", { listing_id: id }); } catch {}

    const { data, error } = await supabase
      .from("listings")
      .select(`
        *, seller:seller_id ( id, username, display_name, avatar_url, kyc_status, created_at )
      `)
      .eq("id", id)
      .single();

    if (error || !data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    const payload = auth ? verifyToken(auth) : null;
    let liked = false;
    if (payload?.userId) {
      const { data: likeRow } = await supabase
        .from("listing_likes")
        .select("id")
        .eq("listing_id", id)
        .eq("user_id", payload.userId)
        .maybeSingle();
      liked = !!likeRow;
    }

    return NextResponse.json({ success: true, data: { ...data, liked } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// PATCH — update listing (seller only)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const allowed = ["title","description","price_pi","category","subcategory",
                     "condition","buying_method","images","stock","location","status","type",
                     "country_code","ship_worldwide"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) { if (key in body) updates[key] = body[key]; }

    const supabase = await createAdminClient();
    const requestedStatus = typeof updates.status === "string" ? String(updates.status) : null;
    if (!requestedStatus) {
      const { data, error } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", id)
        .eq("seller_id", payload.userId) // only own listings
        .select()
        .single();

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: { ...data, status: normalizeListingStatusForUi(data?.status) } });
    }

    let lastError: { message?: string; code?: string } | null = null;
    for (const statusCandidate of fallbackStatuses(requestedStatus)) {
      const nextUpdates = { ...updates, status: statusCandidate };
      const { data, error } = await supabase
        .from("listings")
        .update(nextUpdates)
        .eq("id", id)
        .eq("seller_id", payload.userId)
        .select()
        .single();

      if (!error && data) {
        return NextResponse.json({
          success: true,
          data: { ...data, status: normalizeListingStatusForUi(data.status) },
        });
      }

      if (!error) {
        return NextResponse.json({ success: false, error: "Listing not found or unauthorized" }, { status: 404 });
      }

      lastError = error as { message?: string; code?: string };
      if ((lastError?.code ?? "") !== "23514") break;
    }

    return NextResponse.json({ success: false, error: lastError?.message ?? "Update failed" }, { status: 500 });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// DELETE — soft delete
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const supabase = await createAdminClient();
    const tryStatuses = ["deleted", "removed"];
    let lastError: { message?: string; code?: string } | null = null;
    for (const status of tryStatuses) {
      const { error } = await supabase
        .from("listings")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("seller_id", payload.userId);
      if (!error) return NextResponse.json({ success: true });
      lastError = error as { message?: string; code?: string };
      if ((lastError?.code ?? "") !== "23514") break;
    }

    if (lastError) {
      return NextResponse.json({ success: false, error: lastError.message ?? "Delete failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
