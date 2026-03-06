// app/api/admin/orders/route.ts

import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { getTokenFromRequest } from "@/lib/auth/session";
import * as R from "@/lib/api";

// GET — All orders with filters
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload || payload.role !== "admin") return R.unauthorized();

  const { searchParams } = new URL(req.url);
  const page   = parseInt(searchParams.get("page")   ?? "1");
  const limit  = parseInt(searchParams.get("limit")  ?? "20");
  const status = searchParams.get("status");
  const from   = (page - 1) * limit;

  const supabase = await createAdminClient();

  let query = supabase
    .from("orders")
    .select(`
      *,
      gig:gigs(id, title),
      buyer:users!orders_buyer_id_fkey(id, username),
      seller:users!orders_seller_id_fkey(id, username)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return R.serverError();

  return R.ok({ data, total: count ?? 0, page, limit });
}

// PATCH — Resolve dispute / force complete / cancel
const patchSchema = z.object({
  orderId: z.string().uuid(),
  action:  z.enum(["resolve_buyer", "resolve_seller", "force_complete", "cancel", "reopen"]),
  note:    z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload || payload.role !== "admin") return R.unauthorized();

  const body   = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return R.badRequest("Invalid data");

  const { orderId, action } = parsed.data;
  const supabase = await createAdminClient();

  let update: Record<string, unknown> = {};

  switch (action) {
    case "resolve_buyer":   update = { status: "cancelled",  escrow_released: false }; break;
    case "resolve_seller":  update = { status: "completed",  escrow_released: true  }; break;
    case "force_complete":  update = { status: "completed",  escrow_released: true  }; break;
    case "cancel":          update = { status: "cancelled",  escrow_released: false }; break;
    case "reopen":          update = { status: "in_progress" }; break;
  }

  const { data, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .select()
    .single();

  if (error) return R.serverError("Failed to update order");

  return R.ok(data, `Order ${action} successful`);
}
