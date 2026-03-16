import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { analyzeDispute, shouldAutoResolveDispute } from "@/lib/market/ai";

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const headerKey = req.headers.get("x-cron-key") ?? "";
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const queryKey = new URL(req.url).searchParams.get("key") ?? "";
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";

  if (secret && (headerKey === secret || bearer === secret || queryKey === secret)) return true;

  // Vercel cron calls do not support custom headers.
  // Allow Vercel-originated cron requests in deployed environment.
  if (isVercelCron && process.env.VERCEL === "1") return true;

  return false;
}

async function runCron(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!isAuthorizedCron(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") ?? "20")));

    const supabase = await createAdminClient();

    const { data: disputes, error } = await supabase
      .from("disputes")
      .select("id, order_id, reason, evidence, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    let processed = 0;
    let autoResolved = 0;
    let keptOpen = 0;
    let failed = 0;

    for (const dispute of disputes ?? []) {
      try {
        const { data: order } = await supabase
          .from("orders")
          .select("id, status, buying_method, amount_pi")
          .eq("id", dispute.order_id)
          .single();

        if (!order) {
          failed += 1;
          continue;
        }

        const analysis = await analyzeDispute({
          reason: dispute.reason,
          evidence: Array.isArray(dispute.evidence) ? dispute.evidence.map(String) : [],
          buying_method: order.buying_method,
          order_status: order.status,
          amount_pi: Number(order.amount_pi ?? 0),
        });

        const autoPolicy = shouldAutoResolveDispute(analysis.confidence, Number(order.amount_pi ?? 0));
        const shouldAutoResolve = autoPolicy.ok;
        const nextOrderStatus = analysis.decision === "refund" ? "refunded" : "completed";

        await supabase
          .from("disputes")
          .update({
            ai_decision: analysis.decision,
            ai_reasoning: `${analysis.reasoning} [auto_policy:${autoPolicy.reason}]`,
            ai_confidence: analysis.confidence,
            status: shouldAutoResolve ? "resolved" : "open",
            resolved_at: shouldAutoResolve ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dispute.id);

        if (shouldAutoResolve) {
          await supabase
            .from("orders")
            .update({ status: nextOrderStatus, updated_at: new Date().toISOString() })
            .eq("id", order.id);
          autoResolved += 1;
        } else {
          keptOpen += 1;
        }

        processed += 1;
      } catch {
        failed += 1;
      }
    }

    const finishedAt = new Date();
    await logAiJobRun(supabase, {
      job_name: "market_dispute_cron_check",
      status: failed > 0 ? "partial_success" : "success",
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      processed_count: processed,
      auto_resolved_count: autoResolved,
      still_open_count: keptOpen,
      failed_count: failed,
      meta: { limit },
    });

    if (failed > 0) {
      await sendAiOpsAlert({
        level: "warning",
        title: "Dispute cron finished with failures",
        details: { processed, autoResolved, keptOpen, failed, limit },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        processed,
        auto_resolved: autoResolved,
        still_open: keptOpen,
        failed,
      },
    });
  } catch (error) {
    try {
      const supabase = await createAdminClient();
      await logAiJobRun(supabase, {
        job_name: "market_dispute_cron_check",
        status: "failed",
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        processed_count: 0,
        auto_resolved_count: 0,
        still_open_count: 0,
        failed_count: 1,
        meta: { error: error instanceof Error ? error.message : "unknown_error" },
      });
    } catch {
      // ignore logging failure
    }
    await sendAiOpsAlert({
      level: "error",
      title: "Dispute cron failed",
      details: { error: error instanceof Error ? error.message : "unknown_error" },
    });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

async function logAiJobRun(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  payload: {
    job_name: string;
    status: string;
    started_at: string;
    finished_at: string;
    processed_count: number;
    auto_resolved_count: number;
    still_open_count: number;
    failed_count: number;
    meta: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("ai_job_runs").insert(payload);
  } catch {
    // table may not exist yet; fail silently
  }
}

async function sendAiOpsAlert(payload: { level: "warning" | "error"; title: string; details: Record<string, unknown> }) {
  const webhook = process.env.AI_ALERT_WEBHOOK_URL;
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[${payload.level.toUpperCase()}] ${payload.title}\n${JSON.stringify(payload.details)}`,
      }),
    });
  } catch {
    // ignore alert failure
  }
}

export async function POST(req: NextRequest) {
  return runCron(req);
}

export async function GET(req: NextRequest) {
  return runCron(req);
}
