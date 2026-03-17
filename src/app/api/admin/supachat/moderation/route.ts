import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.treasury.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? "";
  const roomId = searchParams.get("roomId") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const userId = searchParams.get("userId") ?? "";

  let logsQ = supabase
    .from("supachat_moderation_logs")
    .select("id,user_id,room_id,conversation_id,message_content,violation_category,confidence,action_taken,reasoning,created_at")
    .not("action_taken", "in", "(allowed,allowed_low_confidence,fail_open)")
    .order("created_at", { ascending: false })
    .limit(120);
  if (category) logsQ = logsQ.eq("violation_category", category);
  if (roomId) logsQ = logsQ.eq("room_id", roomId);
  if (from) logsQ = logsQ.gte("created_at", from);
  if (to) logsQ = logsQ.lte("created_at", to);
  if (userId) logsQ = logsQ.eq("user_id", userId);

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  const [logsRes, todayCountRes, sanctionsRes, usersRes, roomsRes, strikesRes] = await Promise.all([
    logsQ,
    supabase
      .from("supachat_moderation_logs")
      .select("id", { count: "exact", head: true })
      .not("action_taken", "in", "(allowed,allowed_low_confidence,fail_open)")
      .gte("created_at", startToday.toISOString()),
    supabase
      .from("supachat_sanctions")
      .select("id,user_id,type,reason,expires_at,created_at")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase.from("users").select("id,username,display_name"),
    supabase.from("supachat_rooms").select("id,name"),
    userId
      ? supabase
          .from("supachat_strikes")
          .select("id,user_id,reason,violation_category,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const usersById = Object.fromEntries(((usersRes as any).data ?? []).map((u: any) => [u.id, u]));
  const roomsById = Object.fromEntries(((roomsRes as any).data ?? []).map((r: any) => [r.id, r]));
  const logs = ((logsRes as any).data ?? []).map((l: any) => ({
    ...l,
    user: usersById[l.user_id] ?? null,
    room: l.room_id ? roomsById[l.room_id] ?? null : null,
  }));

  const topCategories: Record<string, number> = {};
  const topUsers: Record<string, number> = {};
  for (const l of logs) {
    const cat = String(l.violation_category ?? "other");
    topCategories[cat] = (topCategories[cat] ?? 0) + 1;
    const uid = String(l.user_id ?? "");
    if (uid) topUsers[uid] = (topUsers[uid] ?? 0) + 1;
  }

  return NextResponse.json({
    success: true,
    data: {
      logs,
      stats: {
        total_violations_today: Number((todayCountRes as any).count ?? 0),
        top_categories: Object.entries(topCategories)
          .map(([k, v]) => ({ category: k, count: v }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
        most_sanctioned_users: Object.entries(topUsers)
          .map(([uid, count]) => ({ user_id: uid, count, user: usersById[uid] ?? null }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
      },
      sanctions: (sanctionsRes as any).data ?? [],
      strike_history: (strikesRes as any).data ?? [],
      rooms: (roomsRes as any).data ?? [],
    },
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.treasury.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const body = await req.json().catch(() => ({}));
  const sanctionId = String(body.sanctionId ?? "");
  const userId = String(body.userId ?? "");
  if (!sanctionId && !userId) {
    return NextResponse.json({ success: false, error: "sanctionId or userId required" }, { status: 400 });
  }

  let q = supabase.from("supachat_sanctions").delete();
  if (sanctionId) q = q.eq("id", sanctionId);
  else q = q.eq("user_id", userId);
  const { error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
