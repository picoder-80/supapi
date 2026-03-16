import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toCSV(rows: Record<string, unknown>[], cols: string[]): string {
  const header = cols.join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const val = r[c] ?? "";
          const str = String(val).replace(/"/g, '""');
          return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
        })
        .join(",")
    )
    .join("\n");
  return header + "\n" + body;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.supascrow.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const type = new URL(req.url).searchParams.get("type") ?? "deals";
  let csv = "";
  let filename = "";

  if (type === "deals") {
    const { data: deals } = await supabase
      .from("supascrow_deals")
      .select("id, title, amount_pi, currency, status, buyer_id, seller_id, tracking_number, tracking_carrier, created_at, updated_at, released_at")
      .order("created_at", { ascending: false });

    const partyIds = [...new Set((deals ?? []).flatMap((d: { buyer_id: string; seller_id: string }) => [d.buyer_id, d.seller_id]))];
    const { data: users } = await supabase.from("users").select("id, username").in("id", partyIds);
    const userMap = new Map((users ?? []).map((u: { id: string; username: string }) => [u.id, u.username]));

    const flat = (deals ?? []).map((d: { buyer_id: string; seller_id: string; [k: string]: unknown }) => ({
      id: d.id,
      title: d.title,
      amount_pi: d.amount_pi,
      currency: d.currency,
      status: d.status,
      buyer: userMap.get(d.buyer_id) ?? d.buyer_id,
      seller: userMap.get(d.seller_id) ?? d.seller_id,
      tracking_number: d.tracking_number ?? "",
      tracking_carrier: d.tracking_carrier ?? "",
      created_at: d.created_at,
      updated_at: d.updated_at,
      released_at: d.released_at ?? "",
    }));
    csv = toCSV(flat, ["id", "title", "amount_pi", "currency", "status", "buyer", "seller", "tracking_number", "tracking_carrier", "created_at", "updated_at", "released_at"]);
    filename = `supascrow_deals_${Date.now()}.csv`;
  }

  if (type === "disputes") {
    const { data: disputes } = await supabase
      .from("supascrow_disputes")
      .select("id, deal_id, initiator_id, reason, resolution, ai_decision, ai_reasoning, ai_confidence, resolved_at, created_at")
      .order("created_at", { ascending: false });

    const flat = (disputes ?? []).map((d: Record<string, unknown>) => ({
      id: d.id,
      deal_id: d.deal_id,
      initiator_id: d.initiator_id,
      reason: d.reason ?? "",
      resolution: d.resolution ?? "",
      ai_decision: d.ai_decision ?? "",
      ai_reasoning: (d.ai_reasoning ?? "").toString().replace(/\n/g, " "),
      ai_confidence: d.ai_confidence ?? "",
      resolved_at: d.resolved_at ?? "",
      created_at: d.created_at,
    }));
    csv = toCSV(flat, ["id", "deal_id", "initiator_id", "reason", "resolution", "ai_decision", "ai_reasoning", "ai_confidence", "resolved_at", "created_at"]);
    filename = `supascrow_disputes_${Date.now()}.csv`;
  }

  if (!csv) return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
