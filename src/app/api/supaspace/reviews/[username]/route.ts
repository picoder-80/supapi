import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const PLATFORM_LABEL: Record<string, string> = {
  user: "Profile",
  listing: "SupaMarket",
  gig: "SupaSkil",
  course: "SupaDemy",
  stay: "SupaDomus",
};

// GET /api/supaspace/reviews/[username]
// Returns all reviews received by this user from all platforms (user, listing, gig, course, stay)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const supabase = await createAdminClient();

    const { data: profileUser } = await supabase.from("users").select("id").eq("username", username).single();
    if (!profileUser) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    const uid = profileUser.id;

    const [listingRows, gigRows, courseRows, stayRows] = await Promise.all([
      supabase.from("listings").select("id").eq("seller_id", uid),
      supabase.from("gigs").select("id").eq("seller_id", uid),
      supabase.from("courses").select("id").eq("instructor_id", uid),
      supabase.from("stays").select("id").eq("host_id", uid),
    ]);
    const listingIds = (listingRows.data ?? []).map((r: { id: string }) => r.id);
    const gigIds = (gigRows.data ?? []).map((r: { id: string }) => r.id);
    const courseIds = (courseRows.data ?? []).map((r: { id: string }) => r.id);
    const stayIds = (stayRows.data ?? []).map((r: { id: string }) => r.id);

    const reviewQueries = [
      supabase.from("reviews").select("id, reviewer_id, rating, comment, created_at, target_type").eq("target_type", "user").eq("target_id", uid),
    ];
    if (listingIds.length > 0) {
      reviewQueries.push(supabase.from("reviews").select("id, reviewer_id, rating, comment, created_at, target_type").eq("target_type", "listing").in("target_id", listingIds));
    }
    if (gigIds.length > 0) {
      reviewQueries.push(supabase.from("reviews").select("id, reviewer_id, rating, comment, created_at, target_type").eq("target_type", "gig").in("target_id", gigIds));
    }
    if (courseIds.length > 0) {
      reviewQueries.push(supabase.from("reviews").select("id, reviewer_id, rating, comment, created_at, target_type").eq("target_type", "course").in("target_id", courseIds));
    }
    if (stayIds.length > 0) {
      reviewQueries.push(supabase.from("reviews").select("id, reviewer_id, rating, comment, created_at, target_type").eq("target_type", "stay").in("target_id", stayIds));
    }

    const results = await Promise.all(reviewQueries);
    const allRows: { id: string; reviewer_id: string; rating: number; comment: string | null; created_at: string; target_type: string }[] = [];
    for (const res of results) {
      const rows = res.data ?? [];
      for (const r of rows) allRows.push(r as any);
    }

    if (allRows.length === 0) {
      return NextResponse.json({ success: true, data: { reviews: [] } });
    }

    const reviewerIds = [...new Set(allRows.map(r => r.reviewer_id))];
    const { data: reviewers } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url")
      .in("id", reviewerIds);
    const reviewerMap = new Map((reviewers ?? []).map((u: any) => [u.id, u]));

    const reviews = allRows
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        target_type: r.target_type,
        platform: PLATFORM_LABEL[r.target_type] ?? r.target_type,
        reviewer: reviewerMap.get(r.reviewer_id) ?? { id: r.reviewer_id, username: "?", display_name: null, avatar_url: null },
      }));

    return NextResponse.json({ success: true, data: { reviews } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
