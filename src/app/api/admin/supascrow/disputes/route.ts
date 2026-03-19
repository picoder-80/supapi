import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.supascrow.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim().toLowerCase(); // open | resolved | all

  type DisputeRow = { id: string; deal_id: string; initiator_id: string; reason?: string; resolution?: string | null; resolved_at?: string | null; created_at?: string; ai_decision?: string | null; ai_reasoning?: string | null; ai_confidence?: number | null; [k: string]: unknown };

  const runDisputesQuery = async (withAiColumns: boolean) => {
    const selectCols = withAiColumns
      ? "id, deal_id, initiator_id, reason, resolution, resolved_at, ai_decision, ai_reasoning, ai_confidence, created_at"
      : "id, deal_id, initiator_id, reason, resolution, resolved_at, created_at";
    let q = supabase
      .from("supascrow_disputes")
      .select(selectCols)
      .order("created_at", { ascending: false });
    if (status === "open") q = q.or("resolution.is.null,resolution.eq.pending");
    else if (status === "resolved") q = q.not("resolution", "is", null).neq("resolution", "pending");
    return q;
  };

  let disputes: DisputeRow[] | null = null;
  let err: Error | null = null;
  const res = await runDisputesQuery(true);
  disputes = res.data as unknown as DisputeRow[] | null;
  err = res.error;

  // Backward compatibility: old DBs may not have ai_* columns yet.
  if (err && /column .*ai_decision.* does not exist/i.test(err.message)) {
    const fallback = await runDisputesQuery(false);
    const fallbackRows = (fallback.data ?? []) as unknown as Record<string, unknown>[];
    disputes = fallbackRows.map((d) => ({
      ...d,
      ai_decision: null,
      ai_reasoning: null,
      ai_confidence: null,
    })) as DisputeRow[];
    err = fallback.error;
  }

  if (err) return NextResponse.json({ success: false, error: err.message }, { status: 500 });

  type DealRow = { id: string; buyer_id: string; seller_id: string; title?: string; amount_pi?: number; currency?: string; [k: string]: unknown };
  const dealIds = [...new Set((disputes ?? []).map((d) => d.deal_id))];
  const { data: deals } = await supabase.from("supascrow_deals").select("*").in("id", dealIds);
  const dealMap = new Map<string, DealRow>(((deals ?? []) as DealRow[]).map((d) => [d.id, d]));

  const partyIds = [...new Set(((deals ?? []) as DealRow[]).flatMap((d) => [d.buyer_id, d.seller_id]))];
  const initiatorIds = [...new Set((disputes ?? []).map((d) => d.initiator_id))];
  const { data: users } = await supabase.from("users").select("id, username, display_name").in("id", [...partyIds, ...initiatorIds]);
  const userMap = new Map((users ?? []).map((u: { id: string }) => [u.id, u]));

  const enriched = (disputes ?? []).map((d) => {
    const deal = dealMap.get(d.deal_id);
    return {
      ...d,
      deal: deal
        ? {
            ...deal,
            buyer: userMap.get(deal.buyer_id) ?? { id: deal.buyer_id, username: "?", display_name: null },
            seller: userMap.get(deal.seller_id) ?? { id: deal.seller_id, username: "?", display_name: null },
          }
        : null,
      initiator: userMap.get(d.initiator_id) ?? { id: d.initiator_id, username: "?", display_name: null },
    };
  });

  return NextResponse.json({ success: true, data: { disputes: enriched, total: enriched.length } });
}
