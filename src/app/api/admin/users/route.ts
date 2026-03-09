// app/api/admin/users/route.ts

import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { getTokenFromRequest } from "@/lib/auth/session";
import * as R from "@/lib/api";

// GET — List all users with filters
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload || payload.role !== "admin") return R.unauthorized();

  const { searchParams } = new URL(req.url);
  const page   = parseInt(searchParams.get("page")   ?? "1");
  const limit  = parseInt(searchParams.get("limit")  ?? "20");
  const search = searchParams.get("search");
  const role   = searchParams.get("role");
  const kyc    = searchParams.get("kyc");
  const from   = (page - 1) * limit;

  const supabase = await createAdminClient();

  let query = supabase
    .from("users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (search) query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
  if (role)   query = query.eq("role", role);
  if (kyc)    query = query.eq("kyc_status", kyc);

  const { data, error, count } = await query;
  if (error) return R.serverError();

  return R.ok({ data, total: count ?? 0, page, limit });
}

// PATCH — Update user (ban, change role, verify KYC)
const patchSchema = z.object({
  userId:    z.string().uuid(),
  action:    z.enum(["ban", "unban", "verify_kyc", "set_role"]),
  role:      z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload || payload.role !== "admin") return R.unauthorized();

  const body   = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return R.badRequest("Invalid data");

  const { userId, action, role } = parsed.data;
  const supabase = await createAdminClient();

  let update: Record<string, unknown> = {};

  switch (action) {
    case "ban":        update = { role: "banned" }; break;
    case "unban":      update = { role: "pioneer" }; break;
    case "verify_kyc": update = { kyc_status: "verified" }; break;
    case "set_role":
      if (!role) return R.badRequest("Role required");
      update = { role };
      break;
  }

  const { data, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", userId)
    .select()
    .single();

  if (error) return R.serverError("Failed to update user");

  return R.ok(data, `User ${action} successful`);
}
