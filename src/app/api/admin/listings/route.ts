// app/api/admin/listings/route.ts

import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { getTokenFromRequest } from "@/lib/auth/session";
import * as R from "@/lib/api";

// GET — All listings with filters
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload || payload.role !== "admin") return R.unauthorized();

  const { searchParams } = new URL(req.url);
  const page     = parseInt(searchParams.get("page")   ?? "1");
  const limit    = parseInt(searchParams.get("limit")  ?? "20");
  const search   = searchParams.get("search");
  const status   = searchParams.get("status");
  const category = searchParams.get("category");
  const from     = (page - 1) * limit;

  const supabase = await createAdminClient();

  let query = supabase
    .from("listings")
    .select("*, seller:users(id, username, email, kyc_status)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (search)   query = query.ilike("title", `%${search}%`);
  if (status)   query = query.eq("status", status);
  if (category) query = query.eq("category", category);

  const { data, error, count } = await query;
  if (error) return R.serverError();

  return R.ok({ data, total: count ?? 0, page, limit });
}

// PATCH — Moderate listing
const patchSchema = z.object({
  listingId: z.string().uuid(),
  action:    z.enum(["approve", "remove", "flag", "feature", "unfeature"]),
});

export async function PATCH(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload || payload.role !== "admin") return R.unauthorized();

  const body   = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return R.badRequest("Invalid data");

  const { listingId, action } = parsed.data;
  const supabase = await createAdminClient();

  let update: Record<string, unknown> = {};

  switch (action) {
    case "approve":   update = { status: "active" }; break;
    case "remove":    update = { status: "removed" }; break;
    case "flag":      update = { status: "pending" }; break;
    case "feature":   update = { is_featured: true }; break;
    case "unfeature": update = { is_featured: false }; break;
  }

  const { data, error } = await supabase
    .from("listings")
    .update(update)
    .eq("id", listingId)
    .select()
    .single();

  if (error) return R.serverError("Failed to update listing");

  return R.ok(data, `Listing ${action} successful`);
}
