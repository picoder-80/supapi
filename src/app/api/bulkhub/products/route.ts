// src/app/api/bulkhub/products/route.ts
// GET  — browse products with filters
// POST — create product listing

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? "all";
  const q        = searchParams.get("q") ?? "";
  const sort     = searchParams.get("sort") ?? "trending";
  const page     = parseInt(searchParams.get("page") ?? "1");
  const limit    = 20;
  const offset   = (page - 1) * limit;

  try {
    let query = supabase.from("bulkhub_products")
      .select("id, supplier_id, title, images, category, moq, price_tiers, lead_time, ship_from, sample_available, view_count, order_count, inquiry_count, created_at")
      .eq("status", "active")
      .range(offset, offset + limit - 1);

    if (category !== "all") query = query.eq("category", category);
    if (q) query = query.ilike("title", `%${q}%`);
    if (sort === "trending")   query = query.order("view_count", { ascending: false });
    else if (sort === "newest") query = query.order("created_at", { ascending: false });
    else if (sort === "orders") query = query.order("order_count", { ascending: false });

    const { data: products } = await query;
    if (!products?.length) return NextResponse.json({ success: true, data: { products: [], suppliers: {} } });

    const supplierIds = [...new Set(products.map((p: any) => p.supplier_id))];
    let suppliersMap: Record<string, any> = {};
    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase.from("bulkhub_suppliers")
        .select("id, company_name, country, logo_url, verified_tier, response_rate").in("id", supplierIds);
      (suppliers ?? []).forEach((s: any) => { suppliersMap[s.id] = s; });
    }

    return NextResponse.json({ success: true, data: { products, suppliers: suppliersMap } });
  } catch (err: any) {
    return NextResponse.json({ success: true, data: { products: [], suppliers: {} } });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { data: supplier } = await supabase.from("bulkhub_suppliers").select("id").eq("user_id", userId).maybeSingle();
  if (!supplier) return NextResponse.json({ success: false, error: "Register as supplier first" }, { status: 400 });

  const { title, description, images, category, moq, price_tiers, lead_time, ship_from, sample_available, sample_price_pi, certifications } = await req.json();
  if (!title?.trim()) return NextResponse.json({ success: false, error: "Title required" }, { status: 400 });
  if (!price_tiers?.length) return NextResponse.json({ success: false, error: "Price tiers required" }, { status: 400 });

  const { data: product, error } = await supabase.from("bulkhub_products").insert({
    supplier_id: supplier.id, user_id: userId,
    title, description: description ?? "", images: images ?? [],
    category: category ?? "others", moq: moq ?? 1,
    price_tiers, lead_time: lead_time ?? "7-14 days",
    ship_from: ship_from ?? "", sample_available: sample_available ?? false,
    sample_price_pi: sample_price_pi ?? 0, certifications: certifications ?? [],
  }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Update supplier product count
  const { data: sup } = await supabase.from("bulkhub_suppliers").select("total_products").eq("id", supplier.id).single();
  if (sup) await supabase.from("bulkhub_suppliers").update({ total_products: sup.total_products + 1 }).eq("id", supplier.id);

  // SC reward first product
  try {
    const { count } = await supabase.from("bulkhub_products").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id);
    if (count === 1) {
      await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", userId).single();
      if (wallet) {
        await supabase.from("supapi_credits").update({ balance: wallet.balance + 100, total_earned: wallet.total_earned + 100 }).eq("user_id", userId);
        await supabase.from("credit_transactions").insert({ user_id: userId, type: "earn", activity: "bulkhub_first_product", amount: 100, balance_after: wallet.balance + 100, note: "📦 First BulkHub product listed!" });
      }
    }
  } catch {}

  return NextResponse.json({ success: true, data: product });
}
