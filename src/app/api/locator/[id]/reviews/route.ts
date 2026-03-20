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
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getUser(req);
  const { data, error } = await supabase
    .from("business_reviews")
    .select("id,rating,comment,images,created_at,users(username,avatar_url)")
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  let myReview: { id: string; rating: number; comment: string | null; images: string[] | null } | null = null;
  if (user?.userId) {
    const { data: own } = await supabase
      .from("business_reviews")
      .select("id,rating,comment,images")
      .eq("business_id", id)
      .eq("user_id", user.userId)
      .maybeSingle();
    if (own) myReview = own;
  }

  return NextResponse.json({ success: true, data: data ?? [], my_review: myReview });
}

// POST /api/locator/[id]/reviews
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { rating, comment, images } = await req.json();
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, error: "Rating 1-5 required" }, { status: 400 });
  }
  const normalizedImages = Array.isArray(images)
    ? images
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];

  const { error } = await supabase
    .from("business_reviews")
    .upsert({ business_id: id, user_id: user.userId, rating, comment, images: normalizedImages });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Recalculate avg
  const { data: reviews } = await supabase
    .from("business_reviews")
    .select("rating")
    .eq("business_id", id);

  if (reviews) {
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    await supabase.from("businesses").update({
      avg_rating: Math.round(avg * 100) / 100,
      review_count: reviews.length,
    }).eq("id", id);
  }

  return NextResponse.json({ success: true });
}