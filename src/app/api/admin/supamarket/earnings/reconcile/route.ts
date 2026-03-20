import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { creditPresetEarning } from "@/lib/wallet/earnings";

type CandidateRow = {
  id: string;
  seller_id: string | null;
  seller_earnings?: { net_pi?: number | null; status?: string | null } | null;
  amount_pi?: number | null;
  seller_net_pi?: number | null;
};

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const execute = Boolean(body?.execute);
    const limit = Math.min(500, Math.max(20, Number(body?.limit ?? 200)));
    const supabase = await createAdminClient();

    const { data: orders, error: ordErr } = await supabase
      .from("orders")
      .select(
        "id, seller_id, amount_pi, seller_net_pi, seller_earnings:seller_earnings!order_id(net_pi, status)"
      )
      .not("listing_id", "is", null)
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (ordErr) return NextResponse.json({ success: false, error: ordErr.message }, { status: 500 });

    const rows = (orders ?? []) as CandidateRow[];
    if (!rows.length) {
      return NextResponse.json({ success: true, data: { mode: execute ? "execute" : "dry_run", scanned: 0, candidates: [] } });
    }

    const orderIds = rows.map((r) => r.id);
    const { data: txRows, error: txErr } = await supabase
      .from("earnings_transactions")
      .select("ref_id, type")
      .in("ref_id", orderIds)
      .in("type", ["market_order_complete", "market_order"]);
    if (txErr) return NextResponse.json({ success: false, error: txErr.message }, { status: 500 });

    const creditedIds = new Set((txRows ?? []).map((r) => String(r.ref_id ?? "")));
    const candidates = rows
      .filter((r) => !creditedIds.has(String(r.id)))
      .map((r) => {
        const se = Array.isArray(r.seller_earnings) ? r.seller_earnings[0] : r.seller_earnings;
        const amount = Number(se?.net_pi ?? r.seller_net_pi ?? r.amount_pi ?? 0);
        return {
          order_id: r.id,
          seller_id: r.seller_id,
          amount_pi: amount,
          seller_earnings_status: se?.status ?? null,
          valid: Boolean(r.seller_id) && Number.isFinite(amount) && amount > 0,
        };
      });

    if (!execute) {
      return NextResponse.json({
        success: true,
        data: {
          mode: "dry_run",
          scanned: rows.length,
          missing_count: candidates.length,
          valid_count: candidates.filter((c) => c.valid).length,
          candidates,
        },
      });
    }

    let credited = 0;
    let skipped = 0;
    const failures: Array<{ order_id: string; reason: string }> = [];

    for (const c of candidates) {
      if (!c.valid) {
        skipped += 1;
        failures.push({ order_id: c.order_id, reason: "invalid_amount_or_seller" });
        continue;
      }
      const res = await creditPresetEarning("market_order_complete", {
        userId: String(c.seller_id),
        amountPi: Number(c.amount_pi),
        refId: c.order_id,
        status: "available",
        note: `Reconcile payout for completed order ${c.order_id}`,
      });
      if (res.ok) credited += 1;
      else {
        skipped += 1;
        failures.push({ order_id: c.order_id, reason: res.reason ?? "credit_failed" });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        mode: "execute",
        scanned: rows.length,
        missing_count: candidates.length,
        credited,
        skipped,
        failures,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
