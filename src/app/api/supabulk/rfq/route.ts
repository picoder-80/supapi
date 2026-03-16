// src/app/api/supabulk/rfq/route.ts
// GET  — list open RFQs
// POST — post new RFQ or submit quote

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
  const page     = parseInt(searchParams.get("page") ?? "1");
  const limit    = 20;
  const offset   = (page - 1) * limit;

  try {
    let query = supabase.from("bulkhub_rfqs")
      .select("id, buyer_id, title, description, category, quantity, unit, target_price_pi, deadline, quote_count, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (category !== "all") query = query.eq("category", category);

    const { data: rfqs } = await query;
    if (!rfqs?.length) return NextResponse.json({ success: true, data: { rfqs: [], buyers: {} } });

    const buyerIds = [...new Set(rfqs.map((r: any) => r.buyer_id))];
    let buyersMap: Record<string, any> = {};
    if (buyerIds.length > 0) {
      const { data: buyers } = await supabase.from("users")
        .select("id, username, display_name, avatar_url, kyc_status").in("id", buyerIds);
      (buyers ?? []).forEach((u: any) => { buyersMap[u.id] = u; });
    }

    return NextResponse.json({ success: true, data: { rfqs, buyers: buyersMap } });
  } catch {
    return NextResponse.json({ success: true, data: { rfqs: [], buyers: {} } });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  // Post RFQ
  if (action === "post_rfq") {
    const { title, description, category, quantity, unit, target_price_pi, deadline, ship_to } = body;
    if (!title?.trim()) return NextResponse.json({ success: false, error: "Title required" }, { status: 400 });

    const { data, error } = await supabase.from("bulkhub_rfqs").insert({
      buyer_id: userId, title, description: description ?? "",
      category: category ?? "others", quantity: quantity ?? 1,
      unit: unit ?? "units", target_price_pi: target_price_pi ?? null,
      deadline: deadline ?? null, ship_to: ship_to ?? "",
    }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  }

  // Submit quote on RFQ
  if (action === "submit_quote") {
    const { rfq_id, price_pi, note, lead_time } = body;
    const { data: supplier } = await supabase.from("bulkhub_suppliers").select("id").eq("user_id", userId).maybeSingle();
    if (!supplier) return NextResponse.json({ success: false, error: "Register as supplier first" }, { status: 400 });

    const { data: rfq } = await supabase.from("bulkhub_rfqs").select("quantity, quote_count").eq("id", rfq_id).single();
    if (!rfq) return NextResponse.json({ success: false, error: "RFQ not found" }, { status: 404 });

    const total_pi = parseFloat(price_pi) * rfq.quantity;

    const { data, error } = await supabase.from("bulkhub_rfq_quotes").upsert({
      rfq_id, supplier_id: supplier.id, price_pi, total_pi, note: note ?? "", lead_time: lead_time ?? "",
    }, { onConflict: "rfq_id,supplier_id" }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    await supabase.from("bulkhub_rfqs").update({ quote_count: rfq.quote_count + 1 }).eq("id", rfq_id);
    return NextResponse.json({ success: true, data });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
