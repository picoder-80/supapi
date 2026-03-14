import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { isAdminRole } from "@/lib/admin/roles";

export async function verifyAdmin(authHeader: string | null): Promise<{ ok: boolean; userId?: string; role?: string }> {
  if (!authHeader?.startsWith("Bearer ")) return { ok: false };
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    if (!payload?.userId) return { ok: false };

    const supabase = await createAdminClient();
    const { data: user } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", payload.userId)
      .single();

    if (!user || !isAdminRole(user.role)) return { ok: false };
    return { ok: true, userId: user.id, role: user.role };
  } catch {
    return { ok: false };
  }
}