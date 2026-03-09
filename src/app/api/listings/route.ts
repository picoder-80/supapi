// app/api/listings/route.ts

import { NextRequest } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import * as R from "@/lib/api";

const createSchema = z.object({
  title:       z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  price_pi:    z.number().positive(),
  category:    z.enum(["electronics","fashion","home","vehicles","services","digital","food","other"]),
  images:      z.array(z.string().url()).min(1).max(8),
  location:    z.string().optional(),
});

// GET — List listings
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page     = parseInt(searchParams.get("page")  ?? "1");
  const limit    = parseInt(searchParams.get("limit") ?? "20");
  const category = searchParams.get("category");
  const search   = searchParams.get("search");
  const from     = (page - 1) * limit;

  const supabase = await createAdminClient();

  let query = supabase
    .from("listings")
    .select("*, seller:users(id, username, display_name, avatar_url, kyc_status)", { count: "exact" })
    .eq("status", "active")
    .order("is_featured", { ascending: false })
    .order("created_at",  { ascending: false })
    .range(from, from + limit - 1);

  if (category) query = query.eq("category", category);
  if (search)   query = query.ilike("title", `%${search}%`);

  const { data, error, count } = await query;
  if (error) return R.serverError();

  return R.ok({
    data,
    total:   count ?? 0,
    page,
    limit,
    hasMore: (count ?? 0) > from + limit,
  });
}

// POST — Create new listing
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return R.unauthorized();

  const body   = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return R.badRequest(parsed.error.errors[0]?.message ?? "Invalid data");

  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("listings")
    .insert({ ...parsed.data, seller_id: payload.userId })
    .select()
    .single();

  if (error) return R.serverError("Failed to create listing");

  return R.created(data, "Listing created successfully");
}
