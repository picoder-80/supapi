import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = await createAdminClient();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";

    const [
      { data: sessions },
      { data: plans },
      { data: invoices },
      { data: subscriptions },
    ] = await Promise.all([
      supabase
        .from("live_sessions")
        .select(`
          id, user_id, title, status, plan_type, viewer_count,
          like_count, comment_count, started_at, ended_at,
          cf_stream_id, cf_playback_url,
          user:user_id ( username, display_name, avatar_url )
        `)
        .order("started_at", { ascending: false })
        .limit(200),
      supabase
        .from("live_plans")
        .select("id, code, name, price_usd, plan_type, active, features, updated_at")
        .order("price_usd", { ascending: true }),
      supabase
        .from("live_invoices")
        .select("id, user_id, status, amount_usd, amount_pi, paid_at, created_at, plan_id")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("live_subscriptions")
        .select(`
          id, user_id, status, cancel_at_period_end,
          current_period_start, current_period_end, canceled_at, updated_at,
          plan:plan_id ( code, name, price_usd ),
          user:user_id ( username, display_name, email )
        `)
        .order("updated_at", { ascending: false })
        .limit(200),
    ]);

    // Filter sessions
    const filteredSessions = (sessions ?? []).filter((s: any) => {
      if (status && s.status !== status) return false;
      if (!q) return true;
      const u = s.user ?? {};
      const text = `${u.username ?? ""} ${u.display_name ?? ""} ${s.title ?? ""}`.toLowerCase();
      return text.includes(q.toLowerCase());
    });

    // Stats
    const now = Date.now();
    const activeSessions = (sessions ?? []).filter((s: any) => s.status === "live");
    const paidInvoices = (invoices ?? []).filter((i: any) => i.status === "paid");
    const totalRevenue = paidInvoices.reduce((acc: number, i: any) => acc + Number(i.amount_usd ?? 0), 0);

    // Current month revenue
    const ymNow = new Date().toISOString().slice(0, 7);
    const currentMonthRevenue = paidInvoices
      .filter((i: any) => String(i.paid_at ?? i.created_at).slice(0, 7) === ymNow)
      .reduce((acc: number, i: any) => acc + Number(i.amount_usd ?? 0), 0);

    const activeSubscriptions = (subscriptions ?? []).filter((s: any) => {
      if (s.status !== "active") return false;
      const periodEnd = new Date(s.current_period_end ?? "").getTime();
      return periodEnd > now;
    });

    // Revenue breakdown
    const sessionRevenue = paidInvoices
      .filter((i: any) => {
        const plan = (plans ?? []).find((p: any) => p.id === i.plan_id);
        return plan?.plan_type === "session";
      })
      .reduce((acc: number, i: any) => acc + Number(i.amount_usd ?? 0), 0);

    const monthlyRevenue = totalRevenue - sessionRevenue;

    const stats = {
      total_sessions: (sessions ?? []).length,
      active_sessions_now: activeSessions.length,
      total_revenue_usd: Number(totalRevenue.toFixed(2)),
      current_month_revenue_usd: Number(currentMonthRevenue.toFixed(2)),
      session_revenue_usd: Number(sessionRevenue.toFixed(2)),
      monthly_revenue_usd: Number(monthlyRevenue.toFixed(2)),
      total_monthly_subscribers: (subscriptions ?? []).length,
      active_monthly_subscribers: activeSubscriptions.length,
      total_invoices_paid: paidInvoices.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        stats,
        sessions: filteredSessions,
        plans: plans ?? [],
        invoices: (invoices ?? []).slice(0, 100),
        subscriptions: subscriptions ?? [],
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
    const mode = String(body?.mode ?? "");
    const nowIso = new Date().toISOString();

    // Update plan price
    if (mode === "plan_price") {
      const id = String(body?.id ?? "");
      const priceUsd = Number(body?.price_usd ?? NaN);
      if (!id || !Number.isFinite(priceUsd) || priceUsd < 0) {
        return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
      }
      const { error } = await supabase
        .from("live_plans")
        .update({ price_usd: Number(priceUsd.toFixed(2)), updated_at: nowIso })
        .eq("id", id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Toggle plan active/inactive
    if (mode === "plan_active") {
      const id = String(body?.id ?? "");
      const active = Boolean(body?.active);
      if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      const { error } = await supabase
        .from("live_plans")
        .update({ active, updated_at: nowIso })
        .eq("id", id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Force end a live session
    if (mode === "end_session") {
      const id = String(body?.id ?? "");
      if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      const { error } = await supabase
        .from("live_sessions")
        .update({ status: "ended", ended_at: nowIso })
        .eq("id", id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Cancel monthly subscription
    if (mode === "cancel_subscription") {
      const id = String(body?.id ?? "");
      if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      const { error } = await supabase
        .from("live_subscriptions")
        .update({ status: "canceled", canceled_at: nowIso, updated_at: nowIso })
        .eq("id", id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Extend monthly subscription by 30 days
    if (mode === "extend_subscription") {
      const id = String(body?.id ?? "");
      if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      const { data: sub } = await supabase
        .from("live_subscriptions")
        .select("current_period_end")
        .eq("id", id)
        .maybeSingle();
      const currentEnd = new Date(String((sub as any)?.current_period_end ?? nowIso));
      currentEnd.setDate(currentEnd.getDate() + 30);
      const { error } = await supabase
        .from("live_subscriptions")
        .update({ current_period_end: currentEnd.toISOString(), status: "active", updated_at: nowIso })
        .eq("id", id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unsupported mode" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
