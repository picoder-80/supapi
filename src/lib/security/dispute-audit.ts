import { createAdminClient } from "@/lib/supabase/server";

type DisputeAuditParams = {
  platform: "market" | "supascrow";
  disputeId: string;
  orderId?: string | null;
  dealId?: string | null;
  actorType: "user" | "admin" | "system";
  actorId?: string | null;
  eventType:
    | "opened"
    | "analysis_updated"
    | "auto_resolved"
    | "admin_resolved"
    | "status_changed"
    | "refund_issued";
  fromStatus?: string | null;
  toStatus?: string | null;
  decision?: string | null;
  confidence?: number | null;
  reasonExcerpt?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logDisputeEvent(params: DisputeAuditParams) {
  try {
    const supabase = await createAdminClient();
    await supabase.from("dispute_audit_logs").insert({
      platform: params.platform,
      dispute_id: params.disputeId,
      order_id: params.orderId ?? null,
      deal_id: params.dealId ?? null,
      actor_type: params.actorType,
      actor_id: params.actorId ?? null,
      event_type: params.eventType,
      from_status: params.fromStatus ?? null,
      to_status: params.toStatus ?? null,
      decision: params.decision ?? null,
      confidence: params.confidence ?? null,
      reason_excerpt: params.reasonExcerpt ? String(params.reasonExcerpt).slice(0, 500) : null,
      metadata: params.metadata ?? {},
      created_at: new Date().toISOString(),
    });
  } catch {
    // Best effort: table may not exist on all environments yet.
  }
}
