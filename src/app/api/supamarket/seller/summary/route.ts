import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

/** Match list endpoint: derive display status after payment / fulfillment hints. */
function normalizePaidStatus<T extends {
  status?: string | null;
  pi_payment_id?: string | null;
  tracking_number?: string | null;
  meetup_location?: string | null;
  buying_method?: string | null;
}>(order: T): T {
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
}

const TERMINAL = new Set(["completed", "cancelled", "refunded"]);

/** Order statuses where seller should monitor or act (tracking, meetup, dispute, etc.). */
const SELLER_ACTION_STATUSES = new Set(["paid", "escrow", "shipped", "meetup_set", "delivered", "disputed"]);

function sellerActionHint(o: {
  status?: string | null;
  buying_method?: string | null;
}): string | null {
  const s = String(o.status ?? "");
  if (s === "disputed") return "Dispute — review & respond";
  if (s === "paid" || s === "escrow") {
    const m = String(o.buying_method ?? "");
    if (m === "ship") return "Add tracking number";
    if (m === "meetup") return "Set meetup location";
    if (m === "both") return "Add tracking or meetup";
    return "Fulfill order";
  }
  if (s === "shipped") return "In transit — buyer to confirm";
  if (s === "meetup_set") return "Meetup arranged — complete handover";
  if (s === "delivered") return "Awaiting buyer to complete";
  return null;
}

// GET — authenticated seller snapshot for Seller Hub
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload?.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const userId = payload.userId;
    const supabase = await createAdminClient();

    const [{ data: listingRows, error: le }, { data: orderRows, error: oe }, { data: returnRows }] = await Promise.all([
      supabase.from("listings").select("id, status, price_pi, stock, created_at").eq("seller_id", userId),
      supabase
        .from("orders")
        .select(`
          id, status, amount_pi, price_pi, pi_payment_id, created_at, updated_at,
          buying_method, tracking_number, meetup_location,
          listing:listing_id ( id, title, images )
        `)
        .eq("seller_id", userId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("market_return_requests")
        .select(`
          id, order_id, status, category, reason, seller_response_deadline, created_at, updated_at,
          order:order_id ( id, amount_pi, listing:listing_id ( title, images ) )
        `)
        .eq("seller_id", userId)
        .in("status", ["pending_seller", "seller_approved_return", "buyer_return_shipped"])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (le) return NextResponse.json({ success: false, error: le.message }, { status: 500 });
    if (oe) return NextResponse.json({ success: false, error: oe.message }, { status: 500 });

    const listings = listingRows ?? [];
    const listingsByStatus: Record<string, number> = {};
    for (const l of listings) {
      const s = String(l.status ?? "unknown");
      listingsByStatus[s] = (listingsByStatus[s] ?? 0) + 1;
    }
    const nActive = listingsByStatus.active ?? 0;
    const nPaused = listingsByStatus.paused ?? 0;
    const nSold = listingsByStatus.sold ?? 0;
    const listingsOther = Math.max(0, listings.length - nActive - nPaused - nSold);

    type OrderRow = Parameters<typeof normalizePaidStatus>[0] & {
      id: string;
      created_at: string;
      updated_at?: string | null;
      amount_pi?: number;
      price_pi?: number;
      listing?: { id?: string; title?: string; images?: string[] } | null;
    };
    const orders = (orderRows ?? []).map((o) => normalizePaidStatus(o as OrderRow)) as OrderRow[];

    const toSummary = (o: OrderRow, includeHint: boolean) => {
      const listing = o.listing ?? null;
      return {
        id:         o.id,
        status:     String(o.status ?? "pending"),
        amount_pi:  Number(o.amount_pi ?? o.price_pi ?? 0),
        created_at: o.created_at,
        updated_at: o.updated_at ?? o.created_at,
        listing_id: listing?.id ?? null,
        title:      listing?.title ?? "Item",
        image:      listing?.images?.[0] ?? null,
        ...(includeHint ? { hint: sellerActionHint(o) } : {}),
      };
    };

    // Sort: disputed first, then by updated_at
    const actionRequiredOrders = orders
      .filter((o) => SELLER_ACTION_STATUSES.has(String(o.status ?? "")))
      .sort((a, b) => {
        const aDisputed = String(a.status ?? "") === "disputed" ? 0 : 1;
        const bDisputed = String(b.status ?? "") === "disputed" ? 0 : 1;
        if (aDisputed !== bDisputed) return aDisputed - bDisputed;
        return new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime();
      })
      .slice(0, 20)
      .map((o) => toSummary(o, true));

    // Pending return requests — seller needs to respond
    const pendingReturnRequests = (returnRows ?? []).map((rr: any) => {
      const order = rr.order ?? {};
      const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing;
      const deadlineMs = new Date(rr.seller_response_deadline ?? "").getTime();
      const hoursLeft = Math.max(0, Math.floor((deadlineMs - Date.now()) / 3600_000));
      return {
        id: rr.id,
        order_id: rr.order_id,
        status: rr.status,
        category: rr.category,
        reason: rr.reason,
        title: listing?.title ?? "Item",
        image: listing?.images?.[0] ?? null,
        amount_pi: Number(order.amount_pi ?? 0),
        seller_response_deadline: rr.seller_response_deadline,
        hours_left: hoursLeft,
        created_at: rr.created_at,
        urgent: hoursLeft < 24,
      };
    });
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const refundedOrders = orders
      .filter((o) => String(o.status ?? "") === "refunded" && String(o.updated_at ?? o.created_at) >= fortyEightHoursAgo)
      .slice(0, 5)
      .map((o) => toSummary(o, false));
    const ordersByStatus: Record<string, number> = {};
    let activePipeline = 0;
    let completedPi = 0;
    let attentionHint = 0;

    for (const o of orders) {
      const s = String(o.status ?? "pending");
      ordersByStatus[s] = (ordersByStatus[s] ?? 0) + 1;
      if (!TERMINAL.has(s)) activePipeline += 1;
      if (s === "completed") {
        completedPi += Number(o.amount_pi ?? o.price_pi ?? 0);
      }
      if (["paid", "escrow", "shipped", "meetup_set", "delivered", "disputed"].includes(s)) {
        attentionHint += 1;
      }
    }

    const actionIds = new Set(actionRequiredOrders.map((x) => x.id));
    const refundIds = new Set(refundedOrders.map((x) => x.id));
    const recentOrders = orders
      .filter((o) => !actionIds.has(o.id) && !refundIds.has(o.id))
      .slice(0, 12)
      .map((o) => toSummary(o, false));

    return NextResponse.json({
      success: true,
      data: {
        listings: {
          total:  listings.length,
          active: nActive,
          paused: nPaused,
          sold:   nSold,
          other:  listingsOther,
        },
        orders: {
          total:           orders.length,
          byStatus:        ordersByStatus,
          activePipeline:  activePipeline,
          attentionHint:   attentionHint,
          completedGrossPi: Math.round(completedPi * 1e6) / 1e6,
        },
        recentOrders,
        actionRequiredOrders,
        refundedOrders,
        pendingReturnRequests,
      },
    });
  } catch (e) {
    console.error("[seller/summary]", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
