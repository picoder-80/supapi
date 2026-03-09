import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

function toCSV(rows: Record<string, any>[], cols: string[]): string {
  const header = cols.join(",");
  const body   = rows.map(r => cols.map(c => {
    const val = r[c] ?? "";
    const str = String(val).replace(/"/g, '""');
    return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
  }).join(",")).join("\n");
  return header + "\n" + body;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type") ?? "orders"; // orders | listings | commissions
  const supabase = await createAdminClient();

  let csv = "";
  let filename = "";

  if (type === "orders") {
    const { data } = await supabase
      .from("orders")
      .select("id, status, amount_pi, buying_method, created_at, pi_payment_id, tracking_number, shipping_city, shipping_country, listing:listing_id(title), buyer:buyer_id(username), seller:seller_id(username)")
      .order("created_at", { ascending: false });
    const flat = (data ?? []).map((o: any) => ({
      id: o.id, status: o.status, amount_pi: o.amount_pi,
      buying_method: o.buying_method, listing: o.listing?.title ?? "",
      buyer: o.buyer?.username ?? "", seller: o.seller?.username ?? "",
      city: o.shipping_city ?? "", country: o.shipping_country ?? "",
      pi_payment_id: o.pi_payment_id ?? "", tracking: o.tracking_number ?? "",
      created_at: o.created_at,
    }));
    csv = toCSV(flat, ["id","status","amount_pi","buying_method","listing","buyer","seller","city","country","pi_payment_id","tracking","created_at"]);
    filename = `supapi_orders_${Date.now()}.csv`;
  }

  if (type === "listings") {
    const { data } = await supabase
      .from("listings")
      .select("id, title, price_pi, category, subcategory, condition, buying_method, stock, status, views, location, created_at, seller:seller_id(username)")
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    const flat = (data ?? []).map((l: any) => ({ ...l, seller: l.seller?.username ?? "" }));
    csv = toCSV(flat, ["id","title","price_pi","category","subcategory","condition","buying_method","stock","status","views","location","seller","created_at"]);
    filename = `supapi_listings_${Date.now()}.csv`;
  }

  if (type === "commissions") {
    const { data } = await supabase
      .from("commissions")
      .select("id, order_amount, commission_pct, commission_pi, seller_net_pi, status, created_at, seller:seller_id(username), buyer:buyer_id(username)")
      .order("created_at", { ascending: false });
    const flat = (data ?? []).map((c: any) => ({ ...c, seller: c.seller?.username ?? "", buyer: c.buyer?.username ?? "" }));
    csv = toCSV(flat, ["id","order_amount","commission_pct","commission_pi","seller_net_pi","status","seller","buyer","created_at"]);
    filename = `supapi_commissions_${Date.now()}.csv`;
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}