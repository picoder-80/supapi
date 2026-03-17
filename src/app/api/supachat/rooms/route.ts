import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";

export async function GET() {
  const supabase = getSupaChatAdminClient();

  const { data: rooms, error } = await supabase
    .from("supachat_rooms")
    .select("id,name,slug,description,category,type,entry_fee_pi,max_users,is_active,is_promoted,promoted_until,created_at,created_by")
    .eq("is_active", true)
    .order("is_promoted", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const roomIds = (rooms ?? []).map((r: any) => r.id);
  const memberCounts: Record<string, number> = {};
  if (roomIds.length > 0) {
    const { data: members } = await supabase
      .from("supachat_room_members")
      .select("room_id")
      .in("room_id", roomIds);
    (members ?? []).forEach((m: any) => {
      memberCounts[m.room_id] = (memberCounts[m.room_id] ?? 0) + 1;
    });
  }

  const response = (rooms ?? []).map((room: any) => ({
    ...room,
    online_count: memberCounts[room.id] ?? 0,
  }));
  return NextResponse.json({ success: true, data: response });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? "").trim().toLowerCase();
  if (!name || !slug) return NextResponse.json({ success: false, error: "name and slug required" }, { status: 400 });

  const supabase = getSupaChatAdminClient();
  const { data, error } = await supabase
    .from("supachat_rooms")
    .insert({
      name,
      slug,
      description: String(body.description ?? ""),
      category: String(body.category ?? "general"),
      type: String(body.type ?? "public"),
      entry_fee_pi: Number(body.entry_fee_pi ?? 0),
      max_users: Number(body.max_users ?? 200),
      created_by: userId,
      is_active: true,
    })
    .select("id,name,slug,description,category,type,entry_fee_pi,max_users,is_active,is_promoted,promoted_until,created_at,created_by")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase
    .from("supachat_room_members")
    .upsert({ room_id: data.id, user_id: userId, role: "host" }, { onConflict: "room_id,user_id" });

  return NextResponse.json({ success: true, data });
}
