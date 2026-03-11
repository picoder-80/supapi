// src/app/api/supa-livvi/route.ts
// GET  — fetch feed
// POST — create post

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
  const tab      = searchParams.get("tab") ?? "trending";
  const page     = parseInt(searchParams.get("page") ?? "1");
  const limit    = 24;
  const offset   = (page - 1) * limit;
  const userId   = getUserId(req);

  try {
    let query = supabase
      .from("supa_livvi_posts")
      .select("id, user_id, caption, images, category, hashtags, location, like_count, save_count, view_count, comment_count, created_at")
      .eq("is_published", true)
      .range(offset, offset + limit - 1);

    if (category !== "all") query = query.eq("category", category);
    query = tab === "trending"
      ? query.order("like_count", { ascending: false })
      : query.order("created_at", { ascending: false });

    const { data: posts } = await query;
    if (!posts || posts.length === 0)
      return NextResponse.json({ success: true, data: { posts: [], users: {} } });

    const userIds = [...new Set(posts.map((p: any) => p.user_id))];
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url, kyc_status")
        .in("id", userIds);
      (users ?? []).forEach((u: any) => { usersMap[u.id] = u; });
    }

    let likedSet = new Set<string>();
    let savedSet = new Set<string>();
    if (userId) {
      const postIds = posts.map((p: any) => p.id);
      const [{ data: likes }, { data: saves }] = await Promise.all([
        supabase.from("supa_livvi_likes").select("post_id").eq("user_id", userId).in("post_id", postIds),
        supabase.from("supa_livvi_saves").select("post_id").eq("user_id", userId).in("post_id", postIds),
      ]);
      (likes ?? []).forEach((l: any) => likedSet.add(l.post_id));
      (saves ?? []).forEach((s: any) => savedSet.add(s.post_id));
    }

    const enriched = posts.map((p: any) => ({
      ...p,
      liked: likedSet.has(p.id),
      saved: savedSet.has(p.id),
    }));

    return NextResponse.json({ success: true, data: { posts: enriched, users: usersMap } });
  } catch (err: any) {
    console.error("[supa-livvi GET]", err);
    return NextResponse.json({ success: true, data: { posts: [], users: {} } });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { caption, images, category, hashtags, location, product_tags } = await req.json();
  if (!images?.length)
    return NextResponse.json({ success: false, error: "At least one image required" }, { status: 400 });

  const { data: post, error } = await supabase
    .from("supa_livvi_posts")
    .insert({
      user_id: userId,
      caption: caption ?? "",
      images,
      category: category ?? "lifestyle",
      hashtags: hashtags ?? [],
      location: location ?? "",
    })
    .select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  if (product_tags?.length && post) {
    await supabase.from("supa_livvi_product_tags").insert(
      product_tags.map((t: any) => ({ ...t, post_id: post.id }))
    );
  }

  // SC reward for first post
  try {
    const { count } = await supabase.from("supa_livvi_posts")
      .select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (count === 1) {
      await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: wallet } = await supabase.from("supapi_credits")
        .select("balance, total_earned").eq("user_id", userId).single();
      if (wallet) {
        const sc = 20;
        await supabase.from("supapi_credits").update({
          balance: wallet.balance + sc,
          total_earned: wallet.total_earned + sc,
        }).eq("user_id", userId);
        await supabase.from("credit_transactions").insert({
          user_id: userId, type: "earn", activity: "first_supa_livvi_post",
          amount: sc, balance_after: wallet.balance + sc,
          note: "✨ First SupaLivvi post bonus!",
        });
      }
    }
  } catch {}

  return NextResponse.json({ success: true, data: post });
}
