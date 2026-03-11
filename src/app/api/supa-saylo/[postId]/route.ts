// src/app/api/supa-saylo/[postId]/route.ts
// GET  — post detail + replies
// POST — like | resaylo | vote | reply

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const userId = getUserId(req);

  const { data: post } = await supabase
    .from("supa_saylo_posts").select("*").eq("id", postId).single();
  if (!post) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const { data: author } = await supabase.from("users")
    .select("id, username, display_name, avatar_url, kyc_status, bio").eq("id", post.user_id).single();

  const { data: replies } = await supabase
    .from("supa_saylo_posts").select("*").eq("parent_id", postId)
    .order("created_at", { ascending: true }).limit(50);

  const replyUserIds = [...new Set((replies ?? []).map((r: any) => r.user_id))];
  let replyUsersMap: Record<string, any> = {};
  if (replyUserIds.length > 0) {
    const { data: replyUsers } = await supabase.from("users")
      .select("id, username, display_name, avatar_url, kyc_status").in("id", replyUserIds);
    (replyUsers ?? []).forEach((u: any) => { replyUsersMap[u.id] = u; });
  }

  let liked = false, resayloD = false, voted: number | null = null;
  let pollVotes: number[] = [];
  if (userId) {
    const [{ data: l }, { data: r }, { data: v }] = await Promise.all([
      supabase.from("supa_saylo_likes").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
      supabase.from("supa_saylo_resaylos").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
      supabase.from("supa_saylo_poll_votes").select("option_index").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
    ]);
    liked = !!l; resayloD = !!r;
    if (v) voted = v.option_index;
  }
  if (post.type === "poll") {
    const { data: allVotes } = await supabase.from("supa_saylo_poll_votes").select("option_index").eq("post_id", postId);
    (allVotes ?? []).forEach((v: any) => { pollVotes[v.option_index] = (pollVotes[v.option_index] ?? 0) + 1; });
  }

  await supabase.from("supa_saylo_posts").update({ view_count: post.view_count + 1 }).eq("id", postId);

  return NextResponse.json({
    success: true,
    data: {
      post: { ...post, liked, "resaylo'd": resayloD, voted, poll_votes: pollVotes },
      author,
      replies: (replies ?? []).map((r: any) => ({ ...r, author: replyUsersMap[r.user_id] })),
    }
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { action, option_index } = await req.json();

  // ── LIKE ──
  if (action === "like") {
    const { data: existing } = await supabase.from("supa_saylo_likes").select("id")
      .eq("post_id", postId).eq("user_id", userId).maybeSingle();
    const { data: p } = await supabase.from("supa_saylo_posts").select("like_count").eq("id", postId).single();
    if (!p) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (existing) {
      await supabase.from("supa_saylo_likes").delete().eq("post_id", postId).eq("user_id", userId);
      await supabase.from("supa_saylo_posts").update({ like_count: Math.max(0, p.like_count - 1) }).eq("id", postId);
      return NextResponse.json({ success: true, data: { liked: false, like_count: Math.max(0, p.like_count - 1) } });
    } else {
      await supabase.from("supa_saylo_likes").insert({ post_id: postId, user_id: userId });
      await supabase.from("supa_saylo_posts").update({ like_count: p.like_count + 1 }).eq("id", postId);
      return NextResponse.json({ success: true, data: { liked: true, like_count: p.like_count + 1 } });
    }
  }

  // ── RESAYLO ──
  if (action === "resaylo") {
    const { data: existing } = await supabase.from("supa_saylo_resaylos").select("id")
      .eq("post_id", postId).eq("user_id", userId).maybeSingle();
    const { data: p } = await supabase.from("supa_saylo_posts").select("resaylo_count").eq("id", postId).single();
    if (!p) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (existing) {
      await supabase.from("supa_saylo_resaylos").delete().eq("post_id", postId).eq("user_id", userId);
      await supabase.from("supa_saylo_posts").update({ resaylo_count: Math.max(0, p.resaylo_count - 1) }).eq("id", postId);
      return NextResponse.json({ success: true, data: { resaylo: false } });
    } else {
      await supabase.from("supa_saylo_resaylos").insert({ post_id: postId, user_id: userId });
      await supabase.from("supa_saylo_posts").update({ resaylo_count: p.resaylo_count + 1 }).eq("id", postId);
      return NextResponse.json({ success: true, data: { resaylo: true } });
    }
  }

  // ── POLL VOTE ──
  if (action === "vote") {
    const { data: existing } = await supabase.from("supa_saylo_poll_votes").select("id")
      .eq("post_id", postId).eq("user_id", userId).maybeSingle();
    if (existing) return NextResponse.json({ success: false, error: "Already voted" }, { status: 400 });
    await supabase.from("supa_saylo_poll_votes").insert({ post_id: postId, user_id: userId, option_index });
    const { data: allVotes } = await supabase.from("supa_saylo_poll_votes").select("option_index").eq("post_id", postId);
    const counts: number[] = [];
    (allVotes ?? []).forEach((v: any) => { counts[v.option_index] = (counts[v.option_index] ?? 0) + 1; });
    return NextResponse.json({ success: true, data: { voted: option_index, poll_votes: counts } });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
