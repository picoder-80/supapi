// app/api/gigs/route.ts

import { NextRequest } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import * as R from "@/lib/api";

const packageSchema = z.object({
  name:          z.string().min(1),
  description:   z.string().min(1),
  price_pi:      z.number().positive(),
  delivery_days: z.number().int().positive(),
  revisions:     z.number().int().min(0),
});

const createSchema = z.object({
  title:       z.string().min(10).max(120),
  description: z.string().min(50).max(5000),
  category:    z.string().min(1),
  packages:    z.array(packageSchema).min(1).max(3),
  images:      z.array(z.string().url()).min(1).max(5),
  tags:        z.array(z.string()).max(5),
});

// GET — List gigs
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page     = parseInt(searchParams.get("page")  ?? "1");
  const limit    = parseInt(searchParams.get("limit") ?? "20");
  const category = searchParams.get("category");
  const search   = searchParams.get("search");
  const from     = (page - 1) * limit;

  const supabase = await createAdminClient();

  let query = supabase
    .from("gigs")
    .select("*, seller:users(id, username, display_name, avatar_url, kyc_status)", { count: "exact" })
    .eq("status", "active")
    .order("rating_avg", { ascending: false })
    .range(from, from + limit - 1);

  if (category) query = query.eq("category", category);
  if (search)   query = query.ilike("title", `%${search}%`);

  const { data, error, count } = await query;
  if (error) return R.serverError();

  return R.ok({ data, total: count ?? 0, page, limit, hasMore: (count ?? 0) > from + limit });
}

// POST — Create new gig
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return R.unauthorized();

  const body   = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return R.badRequest(parsed.error.errors[0]?.message ?? "Invalid data");

  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("gigs")
    .insert({ ...parsed.data, seller_id: payload.userId })
    .select()
    .single();

  if (error) return R.serverError("Failed to create gig");

  return R.created(data, "Gig created successfully");
}
