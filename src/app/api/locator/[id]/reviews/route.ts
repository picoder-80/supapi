import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUser(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
  } catch { return null; }
}

// GET /api/locator/[id]/reviews
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from("business_reviews")
    .select("id,rating,comment,created_at,users(username,avatar_url)")
    .eq("business_id", params.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

// POST /api/locator/[id]/reviews
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { rating, comment } = await req.json();
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, error: "Rating 1-5 required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("business_reviews")
    .upsert({ business_id: params.id, user_id: user.userId, rating, comment });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Recalculate avg
  const { data: reviews } = await supabase
    .from("business_reviews")
    .select("rating")
    .eq("business_id", params.id);

  if (reviews) {
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    await supabase.from("businesses").update({
      avg_rating: Math.round(avg * 100) / 100,
      review_count: reviews.length,
    }).eq("id", params.id);
  }

  return NextResponse.json({ success: true });
}