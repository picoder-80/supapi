import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:     ["paid", "cancelled"],
  paid:        ["shipped", "meetup_set", "cancelled"],
  shipped:     ["delivered"],
  meetup_set:  ["delivered"],
  delivered:   ["completed", "disputed"],
  completed:   [],
  disputed:    [],
  refunded:    [],
  cancelled:   [],
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        listing:listing_id ( id, title, images, price_pi, category, description, location ),
        buyer:buyer_id ( id, username, display_name, avatar_url, phone, email ),
        seller:seller_id ( id, username, display_name, avatar_url, phone ),
        disputes ( * )
      `)
      .eq("id", id)
      .or(`buyer_id.eq.${payload.userId},seller_id.eq.${payload.userId}`)
      .single();

    if (error || !data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
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
    const { status: newStatus, tracking_number, meetup_location, meetup_time, pi_payment_id } = body;

    const supabase = await createAdminClient();
    const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
    if (!order) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    // Validate user is buyer or seller
    if (order.buyer_id !== payload.userId && order.seller_id !== payload.userId)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });

    // Validate transition
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (newStatus && !allowed.includes(newStatus))
      return NextResponse.json({ success: false, error: `Cannot move from ${order.status} to ${newStatus}` }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (newStatus)       updates.status = newStatus;
    if (tracking_number) updates.tracking_number = tracking_number;
    if (meetup_location) updates.meetup_location = meetup_location;
    if (meetup_time)     updates.meetup_time = meetup_time;
    if (pi_payment_id)   updates.pi_payment_id = pi_payment_id;

    // Auto update listing stock when order completed
    if (newStatus === "completed") {
      await supabase.from("listings")
        .update({ stock: Math.max(0, (order as any).stock - 1), updated_at: new Date().toISOString() })
        .eq("id", order.listing_id);
    }

    const { data, error } = await supabase
      .from("orders").update(updates).eq("id", id).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}