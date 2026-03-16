// src/app/api/supabulk/route.ts
// GET  — homepage data: featured suppliers, trending products, stats
// POST — register as supplier

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { getCountry } from "@/lib/market/countries";

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
  try {
    const { searchParams } = new URL(req.url);
    const countryCode = (searchParams.get("country") ?? "").toUpperCase();
    const countryFilter = countryCode && countryCode !== "WORLDWIDE";
    const countryName = countryFilter ? getCountry(countryCode).name : "";

    let featuredSuppliersQuery = supabase.from("bulkhub_suppliers")
      .select("id, company_name, country, logo_url, verified_tier, total_orders, total_products, categories, response_rate, user_id")
      .eq("is_active", true)
      .order("total_orders", { ascending: false })
      .limit(8);
    let trendingProductsQuery = supabase.from("bulkhub_products")
      .select("id, supplier_id, title, images, category, moq, price_tiers, lead_time, ship_from, view_count, order_count")
      .eq("status", "active")
      .order("view_count", { ascending: false })
      .limit(16);

    if (countryFilter && countryName) {
      const pat = `%${countryName}%`;
      featuredSuppliersQuery = featuredSuppliersQuery.ilike("country", pat);
      trendingProductsQuery = trendingProductsQuery.ilike("ship_from", pat);
    }

    const [
      { data: featuredSuppliers },
      { data: trendingProducts },
      { data: openRfqs },
      { count: supplierCount },
      { count: productCount },
    ] = await Promise.all([
      featuredSuppliersQuery,
      trendingProductsQuery,
      supabase.from("bulkhub_rfqs")
        .select("id, title, category, quantity, unit, target_price_pi, deadline, quote_count, created_at, buyer_id")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(6),
      countryFilter && countryName
        ? supabase.from("bulkhub_suppliers").select("id", { count: "exact", head: true }).eq("is_active", true).ilike("country", `%${countryName}%`)
        : supabase.from("bulkhub_suppliers").select("id", { count: "exact", head: true }).eq("is_active", true),
      countryFilter && countryName
        ? supabase.from("bulkhub_products").select("id", { count: "exact", head: true }).eq("status", "active").ilike("ship_from", `%${countryName}%`)
        : supabase.from("bulkhub_products").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);

    // Enrich suppliers with user info
    const supplierUserIds = (featuredSuppliers ?? []).map((s: any) => s.user_id);
    let supplierUsersMap: Record<string, any> = {};
    if (supplierUserIds.length > 0) {
      const { data: users } = await supabase.from("users")
        .select("id, username, avatar_url, kyc_status").in("id", supplierUserIds);
      (users ?? []).forEach((u: any) => { supplierUsersMap[u.id] = u; });
    }

    // Enrich products with supplier info
    const productSupplierIds = [...new Set((trendingProducts ?? []).map((p: any) => p.supplier_id))];
    let productSuppliersMap: Record<string, any> = {};
    if (productSupplierIds.length > 0) {
      const { data: sups } = await supabase.from("bulkhub_suppliers")
        .select("id, company_name, country, verified_tier").in("id", productSupplierIds);
      (sups ?? []).forEach((s: any) => { productSuppliersMap[s.id] = s; });
    }

    // Enrich RFQ buyers
    const rfqBuyerIds = (openRfqs ?? []).map((r: any) => r.buyer_id);
    let rfqBuyersMap: Record<string, any> = {};
    if (rfqBuyerIds.length > 0) {
      const { data: buyers } = await supabase.from("users")
        .select("id, username, avatar_url, kyc_status").in("id", rfqBuyerIds);
      (buyers ?? []).forEach((u: any) => { rfqBuyersMap[u.id] = u; });
    }

    return NextResponse.json({
      success: true,
      data: {
        stats: { suppliers: supplierCount ?? 0, products: productCount ?? 0 },
        featuredSuppliers: (featuredSuppliers ?? []).map((s: any) => ({ ...s, user: supplierUsersMap[s.user_id] })),
        trendingProducts:  (trendingProducts ?? []).map((p: any) => ({ ...p, supplier: productSuppliersMap[p.supplier_id] })),
        openRfqs:          (openRfqs ?? []).map((r: any) => ({ ...r, buyer: rfqBuyersMap[r.buyer_id] })),
      }
    });
  } catch (err: any) {
    console.error("[bulkhub GET]", err);
    return NextResponse.json({ success: true, data: { stats: {}, featuredSuppliers: [], trendingProducts: [], openRfqs: [] } });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  // Register supplier
  if (action === "register_supplier") {
    const { company_name, country, description, categories, established_year } = body;
    if (!company_name?.trim()) return NextResponse.json({ success: false, error: "Company name required" }, { status: 400 });

    const { data: existing } = await supabase.from("bulkhub_suppliers").select("id").eq("user_id", userId).maybeSingle();
    if (existing) return NextResponse.json({ success: false, error: "Already registered as supplier" }, { status: 400 });

    const { data, error } = await supabase.from("bulkhub_suppliers").insert({
      user_id: userId, company_name, country: country ?? "", description: description ?? "",
      categories: categories ?? [], established_year: established_year ?? new Date().getFullYear(),
    }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // SC reward for first supplier registration
    try {
      await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", userId).single();
      if (wallet) {
        await supabase.from("supapi_credits").update({ balance: wallet.balance + 100, total_earned: wallet.total_earned + 100 }).eq("user_id", userId);
        await supabase.from("credit_transactions").insert({ user_id: userId, type: "earn", activity: "bulkhub_supplier_register", amount: 100, balance_after: wallet.balance + 100, note: "📦 BulkHub Supplier registered!" });
      }
    } catch {}

    return NextResponse.json({ success: true, data });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
