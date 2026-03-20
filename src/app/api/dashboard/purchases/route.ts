import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type PurchaseRow = {
  id: string;
  status: string;
  amount_pi: number;
  created_at: string;
  listing_id?: string | null;
  listing: { title: string; images: string[] } | null;
  seller: { username: string } | null;
  legacy?: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const supabase = await createAdminClient();
    const uid = payload.userId;

    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select(`
        id, status, amount_pi, created_at,
        listing:listing_id ( id, title, images ),
        seller:seller_id ( username )
      `)
      .eq("buyer_id", uid)
      .order("created_at", { ascending: false });

    if (ordersErr) {
      return NextResponse.json({ success: false, error: ordersErr.message }, { status: 500 });
    }

    const baseOrders: PurchaseRow[] = (orders ?? []).map((o: any) => ({
      id: String(o.id),
      status: String(o.status ?? "pending"),
      amount_pi: Number(o.amount_pi ?? 0),
      created_at: String(o.created_at),
      listing_id: o.listing?.id ? String(o.listing.id) : null,
      listing: o.listing
        ? { title: String(o.listing.title ?? "Item"), images: Array.isArray(o.listing.images) ? o.listing.images : [] }
        : null,
      seller: o.seller ? { username: String(o.seller.username ?? "unknown") } : null,
    }));

    const existingOrderIds = new Set(baseOrders.map((o) => o.id));

    const { data: legacyTx, error: txErr } = await supabase
      .from("transactions")
      .select("id, amount_pi, created_at, reference_id, reference_type, status, metadata")
      .eq("user_id", uid)
      .eq("status", "completed")
      .eq("reference_type", "listing")
      .order("created_at", { ascending: false });

    if (txErr) {
      return NextResponse.json({ success: false, error: txErr.message }, { status: 500 });
    }

    const listingIds = new Set<string>();
    const candidateLegacy: Array<{
      txId: string;
      amountPi: number;
      createdAt: string;
      orderId: string | null;
      listingId: string | null;
    }> = [];

    for (const tx of legacyTx ?? []) {
      const metadata = (tx.metadata ?? {}) as Record<string, unknown>;
      const orderId = typeof metadata.order_id === "string" && metadata.order_id.trim()
        ? metadata.order_id.trim()
        : (typeof tx.reference_id === "string" ? tx.reference_id : null);
      if (orderId && existingOrderIds.has(orderId)) continue;

      const listingId = typeof metadata.listing_id === "string" && metadata.listing_id.trim()
        ? metadata.listing_id.trim()
        : null;
      if (listingId) listingIds.add(listingId);

      candidateLegacy.push({
        txId: String(tx.id),
        amountPi: Number(tx.amount_pi ?? 0),
        createdAt: String(tx.created_at),
        orderId,
        listingId,
      });
    }

    const listingMap = new Map<string, { title: string; images: string[] }>();
    if (listingIds.size > 0) {
      const { data: listingRows } = await supabase
        .from("listings")
        .select("id, title, images")
        .in("id", Array.from(listingIds));
      for (const row of listingRows ?? []) {
        listingMap.set(String(row.id), {
          title: String(row.title ?? "Item"),
          images: Array.isArray(row.images) ? row.images : [],
        });
      }
    }

    const legacyRows: PurchaseRow[] = candidateLegacy.map((x) => ({
      id: x.orderId ?? `legacy-${x.txId}`,
      status: "completed",
      amount_pi: x.amountPi,
      created_at: x.createdAt,
      listing_id: x.listingId ?? null,
      listing: x.listingId ? (listingMap.get(x.listingId) ?? null) : null,
      seller: null,
      legacy: true,
    }));

    const merged = [...baseOrders, ...legacyRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      data: {
        purchases: merged,
        total: merged.length,
        orders_count: baseOrders.length,
        legacy_count: legacyRows.length,
      },
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
