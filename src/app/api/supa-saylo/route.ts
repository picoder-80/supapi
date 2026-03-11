// src/app/api/supa-saylo/route.ts
// GET  — feed (latest | trending | following)
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

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) ?? [];
  return [...new Set(matches.map(h => h.slice(1).toLowerCase()))];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tab    = searchParams.get("tab") ?? "latest";
  const page   = parseInt(searchParams.get("page") ?? "1");
  const limit  = 20;
  const offset = (page - 1) * limit;
  const userId = getUserId(req);

  try {
    let query = supabase
      .from("supa_saylo_posts")
      .select("id, user_id, content, type, images, link_url, link_preview, poll_options, poll_duration, poll_ends_at, parent_id, quote_id, like_count, resaylo_count, reply_count, quote_count, view_count, created_at")
      .is("parent_id", null) // top-level only
      .range(offset, offset + limit - 1);

    if (tab === "trending") {
      query = query.order("like_count", { ascending: false });
    } else if (tab === "takes") {
      query = query.eq("type", "take").order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data: posts } = await query;
    if (!posts || posts.length === 0)
      return NextResponse.json({ success: true, data: { posts: [], users: {}, trending: [] } });

    // Enrich users
    const userIds = [...new Set(posts.map((p: any) => p.user_id))];
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url, kyc_status, bio")
        .in("id", userIds);
      (users ?? []).forEach((u: any) => { usersMap[u.id] = u; });
    }

    // Quote posts enrichment
    const quoteIds = posts.filter((p: any) => p.quote_id).map((p: any) => p.quote_id);
    let quotesMap: Record<string, any> = {};
    if (quoteIds.length > 0) {
      const { data: quotes } = await supabase
        .from("supa_saylo_posts")
        .select("id, user_id, content, type, images, created_at")
        .in("id", quoteIds);
      (quotes ?? []).forEach((q: any) => { quotesMap[q.id] = q; });
    }

    // Liked / resaylo'd by current user
    let likedSet = new Set<string>();
    let resayloSet = new Set<string>();
    let votedMap: Record<string, number> = {};
    if (userId) {
      const postIds = posts.map((p: any) => p.id);
      const [{ data: likes }, { data: resaylos }, { data: votes }] = await Promise.all([
        supabase.from("supa_saylo_likes").select("post_id").eq("user_id", userId).in("post_id", postIds),
        supabase.from("supa_saylo_resaylos").select("post_id").eq("user_id", userId).in("post_id", postIds),
        supabase.from("supa_saylo_poll_votes").select("post_id, option_index").eq("user_id", userId).in("post_id", postIds),
      ]);
      (likes ?? []).forEach((l: any) => likedSet.add(l.post_id));
      (resaylos ?? []).forEach((r: any) => resayloSet.add(r.post_id));
      (votes ?? []).forEach((v: any) => { votedMap[v.post_id] = v.option_index; });
    }

    // Poll vote counts
    const pollIds = posts.filter((p: any) => p.type === "poll").map((p: any) => p.id);
    let pollVotesMap: Record<string, number[]> = {};
    for (const pid of pollIds) {
      const { data: votes } = await supabase
        .from("supa_saylo_poll_votes").select("option_index").eq("post_id", pid);
      const counts: number[] = [];
      (votes ?? []).forEach((v: any) => { counts[v.option_index] = (counts[v.option_index] ?? 0) + 1; });
      pollVotesMap[pid] = counts;
    }

    const enriched = posts.map((p: any) => ({
      ...p,
      liked: likedSet.has(p.id),
      "resaylo_d": resayloSet.has(p.id),
      voted: votedMap[p.id] ?? null,
      poll_votes: pollVotesMap[p.id] ?? [],
      quoted_post: p.quote_id ? { ...quotesMap[p.quote_id], author: usersMap[quotesMap[p.quote_id]?.user_id] } : null,
    }));

    // Trending hashtags
    const { data: trending } = await supabase
      .from("supa_saylo_hashtags")
      .select("tag, post_count")
      .order("post_count", { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      data: { posts: enriched, users: usersMap, trending: trending ?? [] }
    });
  } catch (err: any) {
    console.error("[supa-saylo GET]", err);
    return NextResponse.json({ success: true, data: { posts: [], users: {}, trending: [] } });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { content, type, images, link_url, poll_options, poll_duration, parent_id, quote_id } = await req.json();
  if (!content?.trim() && !images?.length)
    return NextResponse.json({ success: false, error: "Content required" }, { status: 400 });

  const pollEndsAt = type === "poll" && poll_duration
    ? new Date(Date.now() + poll_duration * 3600 * 1000).toISOString()
    : null;

  const { data: post, error } = await supabase
    .from("supa_saylo_posts")
    .insert({
      user_id: userId,
      content: content?.trim() ?? "",
      type: type ?? "saylo",
      images: images ?? [],
      link_url: link_url ?? "",
      poll_options: poll_options ?? [],
      poll_duration: poll_duration ?? 24,
      poll_ends_at: pollEndsAt,
      parent_id: parent_id ?? null,
      quote_id: quote_id ?? null,
    })
    .select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Update parent reply count
  if (parent_id) {
    const { data: parent } = await supabase.from("supa_saylo_posts").select("reply_count").eq("id", parent_id).single();
    if (parent) await supabase.from("supa_saylo_posts").update({ reply_count: parent.reply_count + 1 }).eq("id", parent_id);
  }

  // Update quote count
  if (quote_id) {
    const { data: quoted } = await supabase.from("supa_saylo_posts").select("quote_count").eq("id", quote_id).single();
    if (quoted) await supabase.from("supa_saylo_posts").update({ quote_count: quoted.quote_count + 1 }).eq("id", quote_id);
  }

  // Update hashtag counts
  const hashtags = extractHashtags(content ?? "");
  for (const tag of hashtags) {
    const { data: existing } = await supabase.from("supa_saylo_hashtags").select("id, post_count").eq("tag", tag).maybeSingle();
    if (existing) {
      await supabase.from("supa_saylo_hashtags").update({ post_count: existing.post_count + 1, last_used: new Date().toISOString() }).eq("tag", tag);
    } else {
      await supabase.from("supa_saylo_hashtags").insert({ tag, post_count: 1 });
    }
  }

  // SC rewards
  try {
    await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { count } = await supabase.from("supa_saylo_posts").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (count === 1) {
      const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", userId).single();
      if (wallet) {
        await supabase.from("supapi_credits").update({ balance: wallet.balance + 15, total_earned: wallet.total_earned + 15 }).eq("user_id", userId);
        await supabase.from("credit_transactions").insert({ user_id: userId, type: "earn", activity: "first_supa_saylo_post", amount: 15, balance_after: wallet.balance + 15, note: "🧵 First SupaSaylo post!" });
      }
    }
  } catch {}

  return NextResponse.json({ success: true, data: post });
}
