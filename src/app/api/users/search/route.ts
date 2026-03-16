import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getTokenFromRequest } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const payload = getTokenFromRequest(req);
    if (!payload?.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ success: true, data: { users: [] } });
    }

    const supabase = await createAdminClient();
    const like = `${q}%`;

    const { data, error } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.${like},display_name.ilike.${like}`)
      .neq("id", payload.userId)
      .order("username", { ascending: true })
      .limit(8);

    if (error) {
      return NextResponse.json({ success: false, error: "Search failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        users: (data ?? []).map((u) => ({
          id: u.id,
          username: u.username,
          display_name: u.display_name,
          avatar_url: u.avatar_url,
        })),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

