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

  const { data: disputes, error } = await supabase
    .from("supascrow_disputes")
    .select("id, deal_id, initiator_id, reason, resolution, resolved_at, ai_decision, ai_reasoning, ai_confidence, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  type DealRow = { id: string; buyer_id: string; seller_id: string; title?: string; amount_pi?: number; currency?: string; [k: string]: unknown };
  const dealIds = [...new Set((disputes ?? []).map((d: { deal_id: string }) => d.deal_id))];
  const { data: deals } = await supabase.from("supascrow_deals").select("*").in("id", dealIds);
  const dealMap = new Map<string, DealRow>(((deals ?? []) as DealRow[]).map((d) => [d.id, d]));

  const partyIds = [...new Set(((deals ?? []) as DealRow[]).flatMap((d) => [d.buyer_id, d.seller_id]))];
  const initiatorIds = [...new Set((disputes ?? []).map((d: { initiator_id: string }) => d.initiator_id))];
  const { data: users } = await supabase.from("users").select("id, username, display_name").in("id", [...partyIds, ...initiatorIds]);
  const userMap = new Map((users ?? []).map((u: { id: string }) => [u.id, u]));

  const enriched = (disputes ?? []).map((d: { deal_id: string; initiator_id: string }) => {
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

  return NextResponse.json({ success: true, data: { disputes: enriched } });
}
