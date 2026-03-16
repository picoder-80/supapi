// GET — browse podcasts | POST — create podcast

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const payload = verifyToken(token);
    return payload?.userId ?? null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? "";
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const supabase = await createAdminClient();
    let query = supabase
      .from("supapods")
      .select(`
        id, title, description, cover_url, category, total_plays, total_episodes, created_at,
        creator:creator_id ( id, username, display_name, avatar_url )
      `, { count: "exact" })
      .eq("status", "active");

    if (category) query = query.eq("category", category);
    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

    if (sort === "popular") query = query.order("total_plays", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    query = query.range(offset, offset + limit - 1);
    const { data, count, error } = await query;

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: { podcasts: data ?? [], total: count ?? 0, page, limit } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, cover_url, category } = body;
  if (!title?.trim()) return NextResponse.json({ success: false, error: "Title required" }, { status: 400 });

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("supapods")
      .insert({
        creator_id: userId,
        title: title.trim(),
        description: description?.trim() ?? "",
        cover_url: cover_url ?? null,
        category: category ?? "others",
        status: "active",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
