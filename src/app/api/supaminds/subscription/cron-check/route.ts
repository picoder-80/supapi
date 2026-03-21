import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function isAuthorizedCron(req: NextRequest) {
  const key = process.env.CRON_SECRET?.trim();
  if (!key) return true;
  const auth = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  const q = req.nextUrl.searchParams.get("key")?.trim();
  return auth === key || q === key;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedCron(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const supabase = await createAdminClient();
    const graceDays = Math.min(14, Math.max(1, parseInt(process.env.SUPAMINDS_GRACE_DAYS ?? "5", 10) || 5));
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const { data: freePlan } = await supabase.from("mind_plans").select("id").eq("code", "free").maybeSingle();
    const freePlanId = freePlan?.id ? String(freePlan.id) : null;

    const { data: rows } = await supabase
      .from("mind_subscriptions")
      .select("id, status, cancel_at_period_end, current_period_end, grace_until")
      .in("status", ["active", "canceled", "grace", "past_due"])
      .limit(500);

    let movedToGrace = 0;
    let movedToExpired = 0;
    let autoCanceled = 0;

    for (const sub of rows ?? []) {
      const id = String((sub as any).id);
      const status = String((sub as any).status);
      const cancelAtEnd = !!(sub as any).cancel_at_period_end;
      const periodEndMs = new Date(String((sub as any).current_period_end ?? "")).getTime();
      const graceUntilMs = new Date(String((sub as any).grace_until ?? "")).getTime();

      if ((status === "active" || status === "canceled") && Number.isFinite(periodEndMs) && periodEndMs <= now) {
        if (cancelAtEnd || status === "canceled") {
          const patch: Record<string, unknown> = {
            status: "expired",
            updated_at: nowIso,
          };
          if (freePlanId) patch.plan_id = freePlanId;
          await supabase.from("mind_subscriptions").update(patch).eq("id", id);
          movedToExpired += 1;
          autoCanceled += 1;
        } else {
          const graceUntil = new Date(now + graceDays * 86_400_000).toISOString();
          await supabase
            .from("mind_subscriptions")
            .update({ status: "grace", grace_until: graceUntil, updated_at: nowIso })
            .eq("id", id);
          movedToGrace += 1;
        }
        continue;
      }

      if (status === "grace" && Number.isFinite(graceUntilMs) && graceUntilMs <= now) {
        const patch: Record<string, unknown> = { status: "expired", updated_at: nowIso };
        if (freePlanId) patch.plan_id = freePlanId;
        await supabase.from("mind_subscriptions").update(patch).eq("id", id);
        movedToExpired += 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: { scanned: (rows ?? []).length, moved_to_grace: movedToGrace, moved_to_expired: movedToExpired, auto_canceled: autoCanceled, grace_days: graceDays },
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
