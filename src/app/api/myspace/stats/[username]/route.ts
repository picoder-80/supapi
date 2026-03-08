import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const supabase = await createAdminClient();

    const { data: user } = await supabase.from("users").select("id").eq("username", username).single();
    if (!user) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const uid = user.id;

    // Run all counts in parallel
    const [listings, gigs, courses, stays, content, classifieds, jobs, reviews, followers, following] = await Promise.all([
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", uid).eq("status", "active"),
      supabase.from("gigs").select("id", { count: "exact", head: true }).eq("seller_id", uid).eq("status", "active"),
      supabase.from("courses").select("id", { count: "exact", head: true }).eq("instructor_id", uid).eq("is_published", true),
      supabase.from("stays").select("id", { count: "exact", head: true }).eq("host_id", uid).eq("is_available", true),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", uid),   // proxy for content
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", uid),   // classifieds placeholder
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", uid),   // jobs placeholder
      supabase.from("reviews").select("id, rating", { count: "exact" }).eq("target_id", uid).eq("target_type", "user"),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", uid),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", uid),
    ]);

    // Avg rating
    const reviewRows = reviews.data ?? [];
    const avgRating = reviewRows.length > 0
      ? (reviewRows.reduce((s: number, r: any) => s + r.rating, 0) / reviewRows.length).toFixed(1)
      : "5.0";

    return NextResponse.json({
      success: true,
      data: {
        listings:   listings.count   ?? 0,
        gigs:       gigs.count       ?? 0,
        courses:    courses.count    ?? 0,
        stays:      stays.count      ?? 0,
        reviews:    reviews.count    ?? 0,
        followers:  followers.count  ?? 0,
        following:  following.count  ?? 0,
        avg_rating: avgRating,
      }
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}