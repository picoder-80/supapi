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

    // ── FIX 1: Revenue current month only (not all-time) ──────────────────
    const usageRows = usage ?? [];
    const latestYm = String((usageRows[0] as any)?.period_ym ?? "");
    const usageCurrent = usageRows.filter((u: any) => String(u.period_ym) === latestYm);

    // All-time revenue (for total stat card)
    const totalRevenueUsd = (invs ?? [])
      .filter((i: any) => i.status === "paid")
      .reduce((acc: number, i: any) => acc + Number(i.amount_usd ?? 0), 0);

    // Current month revenue only (for margin calculation)
    const currentMonthRevenue = (invs ?? [])
      .filter((i: any) => {
        if (i.status !== "paid") return false;
        if (!latestYm) return true;
        const invoiceYm = new Date(i.paid_at ?? i.created_at).toISOString().slice(0, 7).replace("-", "");
        return invoiceYm === latestYm;
      })
      .reduce((acc: number, i: any) => acc + Number(i.amount_usd ?? 0), 0);

    const activeCount = filtered.filter((s: any) => s.status === "active").length;

    const requestsByPlan = usageCurrent.reduce((acc: Record<string, number>, row: any) => {
      const k = String(row.plan_code ?? "unknown");
      acc[k] = (acc[k] ?? 0) + Number(row.requests_count ?? 0);
      return acc;
    }, {});

    const totalRequestsCurrentMonth = usageCurrent.reduce((acc: number, row: any) => acc + Number(row.requests_count ?? 0), 0);

    // Per-model cost rates (USD per request, configurable via env)
    // Based on avg 500 input + 300 output tokens per request
    const COST_PER_REQ = {
      haiku:  Number(process.env.SUPAMINDS_COST_HAIKU_USD  ?? 0.001),  // Haiku ~$0.001/req
      sonnet: Number(process.env.SUPAMINDS_COST_SONNET_USD ?? 0.003),  // Sonnet ~$0.003/req
      opus:   Number(process.env.SUPAMINDS_COST_OPUS_USD   ?? 0.015),  // Opus ~$0.015/req
      other:  Number(process.env.SUPAMINDS_COST_PER_REQ_USD ?? 0.002), // fallback
    };

    const estimatedCostCurrentMonth = usageCurrent.reduce((acc: number, row: any) => {
      const haiku  = Number(row.haiku_requests  ?? 0);
      const sonnet = Number(row.sonnet_requests ?? 0);
      const opus   = Number(row.opus_requests   ?? 0);
      const other  = Number(row.other_requests  ?? 0);
      const total  = Number(row.requests_count  ?? 0);
      // If model breakdown available, use it; otherwise fallback to flat rate
      const hasBreakdown = haiku + sonnet + opus + other > 0;
      if (hasBreakdown) {
        return acc
          + haiku  * COST_PER_REQ.haiku
          + sonnet * COST_PER_REQ.sonnet
          + opus   * COST_PER_REQ.opus
          + other  * COST_PER_REQ.other;
      }
      return acc + total * COST_PER_REQ.other;
    }, 0);

    // Model breakdown for admin visibility
    const modelBreakdown = usageCurrent.reduce((acc: Record<string, number>, row: any) => {
      acc.haiku  = (acc.haiku  ?? 0) + Number(row.haiku_requests  ?? 0);
      acc.sonnet = (acc.sonnet ?? 0) + Number(row.sonnet_requests ?? 0);
      acc.opus   = (acc.opus   ?? 0) + Number(row.opus_requests   ?? 0);
      acc.other  = (acc.other  ?? 0) + Number(row.other_requests  ?? 0);
      return acc;
    }, {});

    // FIX: Use current month revenue vs current month cost for accurate margin
    const estProfitCurrentMonth = currentMonthRevenue - estimatedCostCurrentMonth;
    const estMarginPct = currentMonthRevenue > 0
      ? (estProfitCurrentMonth / currentMonthRevenue) * 100
      : 0;

    const topupRows = topups ?? [];
    const topupPromptsSold = topupRows.reduce((acc: number, t: any) => acc + Number(t.prompts_total ?? 0), 0);
    const topupPromptsRemaining = topupRows.reduce((acc: number, t: any) => acc + Number(t.prompts_remaining ?? 0), 0);

    // ── FIX 2: Provider alerts — persist to DB, fallback to in-memory ─────
    const runtimeAlerts = getAIProviderRuntimeAlerts();

    // Persist any new in-memory alerts to DB for durability across deploys
    if (runtimeAlerts.length > 0) {
      for (const alert of runtimeAlerts) {
        await supabase.from("mind_ai_provider_alerts").upsert({
          provider: alert.provider,
          level: alert.level,
          message: alert.message,
          remaining_requests: alert.remaining_requests ?? null,
          request_limit: alert.request_limit ?? null,
          remaining_pct: alert.remaining_pct ?? null,
          reset_at: alert.reset_at ?? null,
          last_seen_at: alert.last_seen_at,
          updated_at: new Date().toISOString(),
        }, { onConflict: "provider" });
      }
    }

    // Fetch from DB — most recent per provider, last 7 days only
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: dbAlerts } = await supabase
      .from("mind_ai_provider_alerts")
      .select("provider, level, message, remaining_requests, request_limit, remaining_pct, reset_at, last_seen_at, updated_at")
      .gte("updated_at", sevenDaysAgo)
      .order("updated_at", { ascending: false })
      .limit(20);

    const aiRuntimeAlerts = (dbAlerts ?? []).map((a: any) => ({
      provider: String(a.provider ?? "unknown"),
      level: String(a.level ?? "warn"),
      message: String(a.message ?? ""),
      remaining_requests: a.remaining_requests ?? null,
      request_limit: a.request_limit ?? null,
      remaining_pct: a.remaining_pct ?? null,
      reset_at: a.reset_at ?? null,
      last_seen_at: a.last_seen_at ?? a.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total_subscriptions: filtered.length,
          active_subscriptions: activeCount,
          total_revenue_usd: Number(totalRevenueUsd.toFixed(2)),
          current_month_revenue_usd: Number(currentMonthRevenue.toFixed(2)),
          usage_period_ym: latestYm || null,
          usage_requests_current_month: totalRequestsCurrentMonth,
          usage_requests_by_plan: requestsByPlan,
          est_ai_cost_usd_current_month: Number(estimatedCostCurrentMonth.toFixed(2)),
          est_profit_usd_current_month: Number(estProfitCurrentMonth.toFixed(2)),
          est_margin_pct_current_month: Number(estMarginPct.toFixed(2)),
          model_breakdown: modelBreakdown,
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
      const nextFeatures = { ...currentFeatures, monthly_limit: Math.floor(monthlyLimit) };
      const { error } = await supabase
        .from("mind_plans")
        .update({ features: nextFeatures, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (mode === "plan_active") {
      const id = String(body?.id ?? "");
      const active = Boolean(body?.active);
      if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      const { error } = await supabase
        .from("mind_plans")
        .update({ active, updated_at: new Date().toISOString() })
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
