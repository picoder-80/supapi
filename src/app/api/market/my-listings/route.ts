import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// GET /api/market/listings?category=&subcategory=&q=&method=&condition=&sort=&page=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category    = searchParams.get("category") ?? "";
    const subcategory = searchParams.get("subcategory") ?? "";
    const q           = searchParams.get("q") ?? "";
    const method      = searchParams.get("method") ?? "";
    const condition   = searchParams.get("condition") ?? "";
    const sort        = searchParams.get("sort") ?? "newest";
    const page        = parseInt(searchParams.get("page") ?? "1");
    const limit       = 20;
    const offset      = (page - 1) * limit;

    const supabase = await createAdminClient();

    let query = supabase
      .from("listings")
      .select(`
        id, title, description, price_pi, category, subcategory,
        condition, buying_method, images, stock, status, location,
        views, likes, created_at,
        seller:seller_id ( id, username, display_name, avatar_url, kyc_status )
      `, { count: "exact" })
      .eq("status", "active")
      .gt("stock", 0);

    if (category)    query = query.eq("category", category);
    if (subcategory) query = query.eq("subcategory", subcategory);
    if (method)      query = query.or(`buying_method.eq.${method},buying_method.eq.both`);
    if (condition)   query = query.eq("condition", condition);
    if (q)           query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

    if (sort === "newest")    query = query.order("created_at", { ascending: false });
    if (sort === "oldest")    query = query.order("created_at", { ascending: true });
    if (sort === "price_asc") query = query.order("price_pi",   { ascending: true });
    if (sort === "price_desc")query = query.order("price_pi",   { ascending: false });
    if (sort === "popular")   query = query.order("views",      { ascending: false });

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      data: { listings: data ?? [], total: count ?? 0, page, limit }
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// POST /api/market/listings — create listing
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const { title, description, price_pi, category, subcategory,
            condition, buying_method, images, stock, location, type } = body;

    if (!title || !price_pi || !category)
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("listings")
      .insert({
        seller_id: payload.userId, title, description, price_pi,
        category, subcategory, condition: condition ?? "new",
        buying_method: buying_method ?? "both", images: images ?? [],
        stock: stock ?? 1, location, type: type ?? "physical",
        status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
      .select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
