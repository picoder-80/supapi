import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// GET — list orders (buyer or seller)
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") ?? "buyer"; // buyer | seller

    const supabase = await createAdminClient();
    const field = role === "seller" ? "seller_id" : "buyer_id";

    const { data, error } = await supabase
      .from("orders")
      .select(`
        *, 
        listing:listing_id ( id, title, images, price_pi, category ),
        buyer:buyer_id ( id, username, display_name, avatar_url ),
        seller:seller_id ( id, username, display_name, avatar_url )
      `)
      .eq(field, payload.userId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// POST — create order (initiate checkout)
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const { listing_id, buying_method, shipping_name, shipping_address,
            shipping_city, shipping_postcode, shipping_country,
            meetup_location, meetup_time, notes } = body;

    if (!listing_id) return NextResponse.json({ success: false, error: "Missing listing_id" }, { status: 400 });

    const supabase = await createAdminClient();

    // Get listing
    const { data: listing, error: le } = await supabase
      .from("listings").select("*").eq("id", listing_id).single();
    if (le || !listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
    if (listing.status !== "active") return NextResponse.json({ success: false, error: "Listing not available" }, { status: 400 });
    if (listing.seller_id === payload.userId) return NextResponse.json({ success: false, error: "Cannot buy own listing" }, { status: 400 });

    // Create order
    const { data: order, error: oe } = await supabase
      .from("orders")
      .insert({
        listing_id, buyer_id: payload.userId, seller_id: listing.seller_id,
        amount_pi: listing.price_pi, buying_method: buying_method ?? "meetup",
        status: "pending", shipping_name, shipping_address,
        shipping_city, shipping_postcode, shipping_country: shipping_country ?? "Malaysia",
        meetup_location, meetup_time, notes,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
      .select().single();

    if (oe) return NextResponse.json({ success: false, error: oe.message }, { status: 500 });
    return NextResponse.json({ success: true, data: order });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
