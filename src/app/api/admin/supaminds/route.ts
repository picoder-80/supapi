import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { getAIProviderRuntimeAlerts } from "@/lib/ai/platform-assistant";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = await createAdminClient();
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const status = new URL(req.url).searchParams.get("status")?.trim() ?? "";

    const [{ data: subs }, { data: invs }, { data: plans }, { data: usage }, { data: topups }] = await Promise.all([
      supabase
        .from("mind_subscriptions")
        .select(`
          id, user_id, status, cancel_at_period_end, current_period_start, current_period_end, updated_at,
          plan:plan_id ( code, name, price_usd ),
          user:user_id ( username, display_name, email )
        `)
        .order("updated_at", { ascending: false })
        .limit(300),
      supabase
        .from("mind_invoices")
        .select("id, user_id, status, amount_usd, amount_pi, paid_at, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("mind_plans")
        .select("id, code, name, price_usd, interval_unit, interval_count, active, features, updated_at")
        .order("price_usd", { ascending: true }),
      supabase
        .from("mind_usage_monthly")
        .select("user_id, period_ym, plan_code, requests_count, updated_at")
        .order("updated_at", { ascending: false })
        .limit(800),
      supabase
        .from("mind_topup_ledger")
        .select("user_id, prompts_total, prompts_used, prompts_remaining, status, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const filtered = (subs ?? []).filter((s: any) => {
      if (status && String(s.status) !== status) return false;
      if (!q) return true;
      const u = s.user ?? {};
      const text = `${u.username ?? ""} ${u.display_name ?? ""} ${u.email ?? ""}`.toLowerCase();
      return text.includes(q.toLowerCase());
    });

    const totalRevenueUsd = (invs ?? []).filter((i: any) => i.status === "paid").reduce((acc: number, i: any) => acc + Number(i.amount_usd ?? 0), 0);
    const activeCount = filtered.filter((s: any) => s.status === "active").length;
    const usageRows = usage ?? [];
    const latestYm = String((usageRows[0] as any)?.period_ym ?? "");
    const usageCurrent = usageRows.filter((u: any) => String(u.period_ym) === latestYm);
    const requestsByPlan = usageCurrent.reduce((acc: Record<string, number>, row: any) => {
      const k = String(row.plan_code ?? "unknown");
      acc[k] = (acc[k] ?? 0) + Number(row.requests_count ?? 0);
      return acc;
    }, {});
    const totalRequestsCurrentMonth = usageCurrent.reduce((acc: number, row: any) => acc + Number(row.requests_count ?? 0), 0);
    const costPerReqDefault = Number(process.env.SUPAMINDS_COST_PER_REQ_USD ?? 0.002);
    const estimatedCostCurrentMonth = usageCurrent.reduce((acc: number, row: any) => {
      const planCode = String(row.plan_code ?? "free").toUpperCase();
      const envKey = `SUPAMINDS_COST_PER_REQ_${planCode}_USD`;
      const perPlanEnv = Number((process.env as Record<string, string | undefined>)[envKey] ?? NaN);
      const c = Number.isFinite(perPlanEnv) && perPlanEnv > 0 ? perPlanEnv : costPerReqDefault;
      return acc + Number(row.requests_count ?? 0) * c;
    }, 0);
    const estProfitCurrentMonth = totalRevenueUsd - estimatedCostCurrentMonth;
    const estMarginPct = totalRevenueUsd > 0 ? (estProfitCurrentMonth / totalRevenueUsd) * 100 : 0;
    const topupRows = topups ?? [];
    const topupPromptsSold = topupRows.reduce((acc: number, t: any) => acc + Number(t.prompts_total ?? 0), 0);
    const topupPromptsRemaining = topupRows.reduce((acc: number, t: any) => acc + Number(t.prompts_remaining ?? 0), 0);
    const { data: dbAlerts } = await supabase
      .from("mind_ai_provider_alerts")
      .select("provider, level, message, remaining_requests, request_limit, remaining_pct, reset_at, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    const runtimeAlerts = getAIProviderRuntimeAlerts();
    const aiRuntimeAlerts = (dbAlerts ?? []).length
      ? (dbAlerts ?? []).map((a: any) => ({
          provider: String(a.provider ?? "unknown"),
          level: String(a.level ?? "warn"),
          message: String(a.message ?? ""),
          remaining_requests: a.remaining_requests ?? null,
          request_limit: a.request_limit ?? null,
          remaining_pct: a.remaining_pct ?? null,
          reset_at: a.reset_at ?? null,
          last_seen_at: a.created_at,
        }))
      : runtimeAlerts;

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total_subscriptions: filtered.length,
          active_subscriptions: activeCount,
          total_revenue_usd: Number(totalRevenueUsd.toFixed(2)),
          usage_period_ym: latestYm || null,
          usage_requests_current_month: totalRequestsCurrentMonth,
          usage_requests_by_plan: requestsByPlan,
          est_ai_cost_usd_current_month: Number(estimatedCostCurrentMonth.toFixed(2)),
          est_profit_usd_current_month: Number(estProfitCurrentMonth.toFixed(2)),
          est_margin_pct_current_month: Number(estMarginPct.toFixed(2)),
          topup_prompts_sold: topupPromptsSold,
          topup_prompts_remaining: topupPromptsRemaining,
        },
        subscriptions: filtered,
        invoices: (invs ?? []).slice(0, 80),
        plans: plans ?? [],
        usage: usageCurrent.slice(0, 200),
        topups: topupRows.slice(0, 120),
        ai_runtime_alerts: aiRuntimeAlerts,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const supabase = await createAdminClient();
    const mode = String(body?.mode ?? "subscription_status");
    if (mode === "subscription_status") {
      const id = String(body?.id ?? "");
      const status = String(body?.status ?? "");
      if (!id || !["active", "past_due", "grace", "canceled", "expired"].includes(status)) {
        return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
      }
      const { error } = await supabase
        .from("mind_subscriptions")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (mode === "plan_price") {
      const id = String(body?.id ?? "");
      const priceUsd = Number(body?.price_usd ?? NaN);
      if (!id || !Number.isFinite(priceUsd) || priceUsd < 0) {
        return NextResponse.json({ success: false, error: "Invalid plan payload" }, { status: 400 });
      }
      const { error } = await supabase
        .from("mind_plans")
        .update({ price_usd: Number(priceUsd.toFixed(2)), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (mode === "plan_limits") {
      const id = String(body?.id ?? "");
      const monthlyLimit = Number(body?.monthly_limit ?? NaN);
      if (!id || !Number.isFinite(monthlyLimit) || monthlyLimit < 1) {
        return NextResponse.json({ success: false, error: "Invalid plan limit payload" }, { status: 400 });
      }
      const { data: current } = await supabase
        .from("mind_plans")
        .select("features")
        .eq("id", id)
        .maybeSingle();
      const currentFeatures = current?.features && typeof current.features === "object"
        ? (current.features as Record<string, unknown>)
        : {};
      const nextFeatures = {
        ...currentFeatures,
        monthly_limit: Math.floor(monthlyLimit),
      };
      const { error } = await supabase
        .from("mind_plans")
        .update({ features: nextFeatures, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (mode === "run_cron") {
      const r = await fetch(`${req.nextUrl.origin}/api/supaminds/subscription/cron-check`, {
        method: "POST",
        headers: process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : undefined,
      });
      const d = await r.json().catch(() => ({}));
      return NextResponse.json({ success: !!d?.success, data: d?.data, error: d?.error });
    }

    return NextResponse.json({ success: false, error: "Unsupported mode" }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
