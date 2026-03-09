import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function verifyAdmin(authHeader: string | null): Promise<{ ok: boolean; userId?: string }> {
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

    if (!user || user.role !== "admin") return { ok: false };
    return { ok: true, userId: user.id };
  } catch {
    return { ok: false };
  }
}