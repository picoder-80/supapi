import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { expireMarketPendingOrders } from "@/lib/market/expire-pending-orders";

const normalizePaidStatus = <T extends {
  status?: string | null;
  pi_payment_id?: string | null;
  tracking_number?: string | null;
  meetup_location?: string | null;
  buying_method?: string | null;
}>(order: T): T => {
  if (order.status !== "pending" || !order.pi_payment_id) return order;

  const hasTracking = Boolean(order.tracking_number?.trim());
  const hasMeetup = Boolean(order.meetup_location?.trim());
  const method = order.buying_method ?? "";

  if ((method === "ship" || method === "both") && hasTracking) {
    return { ...order, status: "shipped" };
  }
  if ((method === "meetup" || method === "both") && hasMeetup) {
    return { ...order, status: "meetup_set" };
  }
  return { ...order, status: "paid" };
};

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
    try {
      await expireMarketPendingOrders({ supabase, limit: 150 });
    } catch {}
    const field = role === "seller" ? "seller_id" : "buyer_id";

    const { data, error } = await supabase
      .from("orders")
      .select(`
        *, 
        listing:listing_id ( id, title, images, price_pi, category, subcategory ),
        buyer:buyer_id ( id, username, display_name, avatar_url ),
        seller:seller_id ( id, username, display_name, avatar_url )
      `)
      .eq(field, payload.userId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    const normalized = (data ?? []).map((o) => normalizePaidStatus(o));

    const orderIds = normalized.map((o: { id: string }) => String(o.id)).filter(Boolean);
    const returnByOrder = new Map<string, { status: string; created_at: string }>();
    if (orderIds.length) {
      const { data: rrs } = await supabase
        .from("market_return_requests")
        .select("order_id, status, created_at")
        .in("order_id", orderIds);
      for (const rr of rrs ?? []) {
        const oid = String((rr as { order_id: string }).order_id);
        const prev = returnByOrder.get(oid);
        const created = String((rr as { created_at: string }).created_at);
        if (!prev || new Date(created) > new Date(prev.created_at)) {
          returnByOrder.set(oid, { status: String((rr as { status: string }).status), created_at: created });
        }
      }
    }

    const withReturn = normalized.map((o: Record<string, unknown> & { id: string }) => {
      const rr = returnByOrder.get(String(o.id));
      return {
        ...o,
        return_badge: rr && ["pending_seller", "seller_approved_return", "buyer_return_shipped", "seller_rejected", "escalated"].includes(rr.status) ? rr : null,
      };
    });

    if (role === "buyer") {
      const listingIds = withReturn
        .map((o) => String((o as { listing_id?: string | null }).listing_id ?? ""))
        .filter(Boolean);
      const reviewed = new Set<string>();
      if (listingIds.length) {
        const { data: revs } = await supabase
          .from("reviews")
          .select("target_id")
          .eq("reviewer_id", payload.userId)
          .eq("target_type", "listing")
          .in("target_id", listingIds);
        for (const r of revs ?? []) {
          const tid = String((r as { target_id?: string | null }).target_id ?? "");
          if (tid) reviewed.add(tid);
        }
      }
      const withReview = withReturn.map((o) => ({
        ...o,
        has_review: reviewed.has(String((o as { listing_id?: string | null }).listing_id ?? "")),
      }));
      return NextResponse.json({ success: true, data: withReview });
    }

    return NextResponse.json({ success: true, data: withReturn });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// POST — create order (initiate checkout)
export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, "market_order_create", 15, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please retry shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const { listing_id, buying_method, shipping_name, shipping_address,
            shipping_city, shipping_postcode, shipping_country,
            meetup_location, meetup_time, notes } = body;

    if (!listing_id) return NextResponse.json({ success: false, error: "Missing listing_id" }, { status: 400 });

    const buyingMethod = buying_method ?? "meetup";
    if (buyingMethod === "ship") {
      if (!shipping_name?.trim() || !shipping_address?.trim() || !shipping_city?.trim() || !shipping_postcode?.trim()) {
        return NextResponse.json({ success: false, error: "Shipping address required for ship orders" }, { status: 400 });
      }
    }

    const supabase = await createAdminClient();

    // Get listing
    const { data: listing, error: le } = await supabase
      .from("listings").select("*").eq("id", listing_id).single();
    if (le || !listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
    if (listing.status !== "active") return NextResponse.json({ success: false, error: "Listing not available" }, { status: 400 });
    if ((listing.stock ?? 0) < 1) return NextResponse.json({ success: false, error: "Out of stock" }, { status: 400 });
    if (listing.seller_id === payload.userId) return NextResponse.json({ success: false, error: "Cannot buy own listing" }, { status: 400 });

    const amountPi = Number(listing.price_pi ?? listing.amount_pi ?? 0);
    if (!amountPi || amountPi <= 0) {
      return NextResponse.json({ success: false, error: "Invalid listing price" }, { status: 400 });
    }

    // Create order (amount_pi + price_pi for DB compatibility)
    const { data: order, error: oe } = await supabase
      .from("orders")
      .insert({
        listing_id, buyer_id: payload.userId, seller_id: listing.seller_id,
        amount_pi: amountPi, price_pi: amountPi, buying_method: buying_method ?? "meetup",
        status: "pending", shipping_name, shipping_address,
        shipping_city, shipping_postcode, shipping_country: shipping_country ?? "United States",
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
