import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";

const ROOM_ENTRY_COMMISSION_KEY = "supachat_room_entry_commission_pct";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const txid = String(body.txid ?? "");
  const piPaymentId = String(body.pi_payment_id ?? "");

  const supabase = getSupaChatAdminClient();
  const { data: room } = await supabase
    .from("supachat_rooms")
    .select("id,type,entry_fee_pi,created_by")
    .eq("id", id)
    .maybeSingle();
  if (!room) return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });

  const existing = await supabase
    .from("supachat_room_entries")
    .select("id")
    .eq("room_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.data?.id) {
    await supabase
      .from("supachat_room_members")
      .upsert({ room_id: id, user_id: userId, role: "member" }, { onConflict: "room_id,user_id" });
    return NextResponse.json({ success: true, data: { already_joined: true } });
  }

  const fee = Number(room.entry_fee_pi ?? 0);
  if (room.type === "paid" && fee > 0 && (!txid.trim() || !piPaymentId.trim())) {
    return NextResponse.json(
      { success: false, error: "Payment proof required for paid room entry" },
      { status: 400 }
    );
  }

  const { data: commConfig } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", ROOM_ENTRY_COMMISSION_KEY)
    .maybeSingle();
  const commissionPct = Math.min(50, Math.max(0, parseFloat(commConfig?.value ?? "20") || 20));
  const commissionPi = Number((fee * (commissionPct / 100)).toFixed(7));
  const hostPi = Number((fee - commissionPi).toFixed(7));

  const { error } = await supabase.from("supachat_room_entries").insert({
    room_id: id,
    user_id: userId,
    entry_fee_pi: fee,
    commission_pct: commissionPct,
    commission_pi: commissionPi,
    host_pi: hostPi,
    pi_payment_id: piPaymentId || null,
    txid: txid || null,
  });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase
    .from("supachat_room_members")
    .upsert({ room_id: id, user_id: userId, role: "member" }, { onConflict: "room_id,user_id" });
  await supabase.from("supachat_revenue").insert({
    type: "room_entry",
    source_id: id,
    amount_pi: commissionPi,
  });
  await supabase.from("supachat_room_messages").insert({
    room_id: id,
    sender_id: userId,
    content: "joined the room",
    type: "system",
    metadata: { kind: "join", user_id: userId },
  });

  return NextResponse.json({
    success: true,
    data: { room_id: id, entry_fee_pi: fee, host_id: room.created_by, host_pi: hostPi },
  });
}
