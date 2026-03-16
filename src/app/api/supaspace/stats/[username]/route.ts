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

    // Counts: listings (market), gigs, courses, stays, jobs, classifieds, bulk, domus, machina, endoro, followers, following, referrals, pets
    const queries = [
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", uid).eq("status", "active"),
      supabase.from("gigs").select("id", { count: "exact", head: true }).eq("seller_id", uid).eq("status", "active"),
      supabase.from("courses").select("id", { count: "exact", head: true }).eq("instructor_id", uid).eq("is_published", true),
      supabase.from("stays").select("id", { count: "exact", head: true }).eq("host_id", uid).eq("is_available", true),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", uid).eq("status", "active").eq("category", "jobs_services"),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", uid).eq("status", "active").in("category", ["property", "leisure", "pets", "travel"]),
      supabase.from("bulkhub_suppliers").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("is_active", true),
      supabase.from("domus_listings").select("id", { count: "exact", head: true }).eq("seller_id", uid).eq("status", "active"),
      supabase.from("machina_listings").select("id", { count: "exact", head: true }).eq("seller_id", uid).eq("status", "active"),
      supabase.from("endoro_vehicles").select("id", { count: "exact", head: true }).eq("host_id", uid).eq("status", "active"),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", uid),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", uid),
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", uid),
      supabase.from("supapets_pets").select("id", { count: "exact", head: true }).eq("user_id", uid),
    ];
    const results = await Promise.allSettled(queries);
    const getCount = (r: PromiseSettledResult<any>) => (r.status === "fulfilled" && r.value?.count != null ? r.value.count : 0);
    const listings = { count: getCount(results[0]) };
    const gigs = { count: getCount(results[1]) };
    const courses = { count: getCount(results[2]) };
    const stays = { count: getCount(results[3]) };
    const jobs = { count: getCount(results[4]) };
    const classifieds = { count: getCount(results[5]) };
    const bulk = { count: getCount(results[6]) };
    const domus = { count: getCount(results[7]) };
    const machina = { count: getCount(results[8]) };
    const endoro = { count: getCount(results[9]) };
    const followers = { count: getCount(results[10]) };
    const following = { count: getCount(results[11]) };
    const referrals = { count: getCount(results[12]) };
    const pets = { count: getCount(results[13]) };

    // IDs owned by this user (for aggregating reviews across platforms)
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

    // Accumulate reviews from ALL platforms: user, listing (market), gig (SupaSkil), course (academy), stay (properties)
    const reviewQueries = [
      supabase.from("reviews").select("id, rating").eq("target_type", "user").eq("target_id", uid),
    ];
    if (listingIds.length > 0) {
      reviewQueries.push(supabase.from("reviews").select("id, rating").eq("target_type", "listing").in("target_id", listingIds));
    }
    if (gigIds.length > 0) {
      reviewQueries.push(supabase.from("reviews").select("id, rating").eq("target_type", "gig").in("target_id", gigIds));
    }
    if (courseIds.length > 0) {
      reviewQueries.push(supabase.from("reviews").select("id, rating").eq("target_type", "course").in("target_id", courseIds));
    }
    if (stayIds.length > 0) {
      reviewQueries.push(supabase.from("reviews").select("id, rating").eq("target_type", "stay").in("target_id", stayIds));
    }

    const reviewResults = await Promise.all(reviewQueries);
    const allRatings: number[] = [];
    for (const res of reviewResults) {
      const rows = res.data ?? [];
      for (const r of rows) allRatings.push(Number((r as { rating: number }).rating));
    }
    const reviewCount = allRatings.length;
    const avgRating = reviewCount > 0
      ? (allRatings.reduce((a, b) => a + b, 0) / reviewCount).toFixed(1)
      : "5.0";

    return NextResponse.json({
      success: true,
      data: {
        listings:    listings.count    ?? 0,
        gigs:       gigs.count        ?? 0,
        courses:    courses.count     ?? 0,
        stays:      stays.count       ?? 0,
        jobs:       jobs.count        ?? 0,
        classifieds: classifieds.count ?? 0,
        bulk:       bulk.count        ?? 0,
        domus:      domus.count       ?? 0,
        machina:    machina.count     ?? 0,
        endoro:     endoro.count      ?? 0,
        reviews:    reviewCount,
        followers:  followers.count   ?? 0,
        following:  following.count   ?? 0,
        referrals:  referrals.count   ?? 0,
        pets:       pets.count        ?? 0,
        avg_rating: avgRating,
      }
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}