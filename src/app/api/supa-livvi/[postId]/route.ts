// src/app/api/supa-livvi/[postId]/route.ts
// GET  — single post detail + comments
// POST — like / save / comment actions

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
    .from("supa_livvi_posts")
    .select("*, supa_livvi_product_tags(*)")
    .eq("id", postId).single();

  if (!post) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const { data: author } = await supabase.from("users")
    .select("id, username, display_name, avatar_url, kyc_status, bio").eq("id", post.user_id).single();

  const { data: comments } = await supabase.from("supa_livvi_comments")
    .select("id, content, created_at, user_id, users(username, display_name, avatar_url)")
    .eq("post_id", postId).order("created_at", { ascending: true }).limit(50);

  let liked = false, saved = false;
  if (userId) {
    const [{ data: l }, { data: s }] = await Promise.all([
      supabase.from("supa_livvi_likes").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
      supabase.from("supa_livvi_saves").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
    ]);
    liked = !!l; saved = !!s;
  }

  await supabase.from("supa_livvi_posts")
    .update({ view_count: post.view_count + 1 }).eq("id", postId);

  return NextResponse.json({
    success: true,
    data: { post: { ...post, liked, saved }, author, comments: comments ?? [] }
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { action, content } = await req.json();

  // ── LIKE ──
  if (action === "like") {
    const { data: existing } = await supabase.from("supa_livvi_likes").select("id")
      .eq("post_id", postId).eq("user_id", userId).maybeSingle();

    const { data: p } = await supabase.from("supa_livvi_posts")
      .select("like_count").eq("id", postId).single();
    if (!p) return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });

    if (existing) {
      await supabase.from("supa_livvi_likes").delete().eq("post_id", postId).eq("user_id", userId);
      await supabase.from("supa_livvi_posts").update({ like_count: Math.max(0, p.like_count - 1) }).eq("id", postId);
      return NextResponse.json({ success: true, data: { liked: false, like_count: Math.max(0, p.like_count - 1) } });
    } else {
      await supabase.from("supa_livvi_likes").insert({ post_id: postId, user_id: userId });
      await supabase.from("supa_livvi_posts").update({ like_count: p.like_count + 1 }).eq("id", postId);
      return NextResponse.json({ success: true, data: { liked: true, like_count: p.like_count + 1 } });
    }
  }

  // ── SAVE ──
  if (action === "save") {
    const { data: existing } = await supabase.from("supa_livvi_saves").select("id")
      .eq("post_id", postId).eq("user_id", userId).maybeSingle();

    const { data: p } = await supabase.from("supa_livvi_posts")
      .select("save_count").eq("id", postId).single();
    if (!p) return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });

    if (existing) {
      await supabase.from("supa_livvi_saves").delete().eq("post_id", postId).eq("user_id", userId);
      await supabase.from("supa_livvi_posts").update({ save_count: Math.max(0, p.save_count - 1) }).eq("id", postId);
      return NextResponse.json({ success: true, data: { saved: false } });
    } else {
      await supabase.from("supa_livvi_saves").insert({ post_id: postId, user_id: userId });
      await supabase.from("supa_livvi_posts").update({ save_count: p.save_count + 1 }).eq("id", postId);
      return NextResponse.json({ success: true, data: { saved: true } });
    }
  }

  // ── COMMENT ──
  if (action === "comment") {
    if (!content?.trim()) return NextResponse.json({ success: false, error: "Empty comment" }, { status: 400 });
    const { data: comment } = await supabase.from("supa_livvi_comments")
      .insert({ post_id: postId, user_id: userId, content: content.trim() }).select().single();
    const { data: p } = await supabase.from("supa_livvi_posts")
      .select("comment_count").eq("id", postId).single();
    if (p) await supabase.from("supa_livvi_posts")
      .update({ comment_count: p.comment_count + 1 }).eq("id", postId);
    return NextResponse.json({ success: true, data: comment });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
