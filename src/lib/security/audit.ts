import { createAdminClient } from "@/lib/supabase/server";

export async function logAdminAction(params: {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail?: Record<string, unknown>;
}) {
  try {
    const supabase = await createAdminClient();
    await supabase.from("admin_audit_logs").insert({
      admin_user_id: params.adminUserId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      detail: params.detail ?? {},
      created_at: new Date().toISOString(),
    });
  } catch {
    // Best effort: table may not exist yet
  }
}
