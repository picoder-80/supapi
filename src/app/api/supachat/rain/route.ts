import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const roomId = String(body.roomId ?? "");
  const totalPi = Number(body.totalPi ?? 0);
  const idempotencyKey = String(body.idempotencyKey ?? "").trim();
  const txid = String(body.txid ?? "").trim();
  const piPaymentId = String(body.pi_payment_id ?? "").trim();
  if (!roomId || totalPi <= 0) return NextResponse.json({ success: false, error: "roomId and totalPi required" }, { status: 400 });
  if (!txid || !piPaymentId) {
    return NextResponse.json({ success: false, error: "Payment proof required (txid, pi_payment_id)" }, { status: 400 });
  }

  const supabase = getSupaChatAdminClient();
  const { data: member } = await supabase
    .from("supachat_room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member || (member.role !== "host" && member.role !== "moderator")) {
    return NextResponse.json({ success: false, error: "Only host/moderator can start Pi Rain" }, { status: 403 });
  }

  if (piPaymentId || idempotencyKey) {
    const identity = piPaymentId || idempotencyKey;
    const { data: existing } = await supabase
      .from("supachat_rain_events")
      .select("id,total_pi,per_user_pi,recipient_count,status")
      .eq("host_id", userId)
      .eq("room_id", roomId)
      .eq("pi_payment_id", identity)
      .maybeSingle();
    if (existing) return NextResponse.json({ success: true, data: existing, idempotent: true });
  }

  const { data: members } = await supabase
    .from("supachat_room_members")
    .select("user_id")
    .eq("room_id", roomId);
  const recipients = [...new Set((members ?? []).map((m: any) => m.user_id).filter((id: string) => id !== userId))];
  const recipientCount = recipients.length;
  if (recipientCount <= 0) {
    return NextResponse.json({ success: false, error: "No recipients in room" }, { status: 400 });
  }

  const serviceFee = 0.1;
  const distributable = Math.max(totalPi - serviceFee, 0);
  const perUser = Number((distributable / recipientCount).toFixed(7));

  const { data: rain, error } = await supabase
    .from("supachat_rain_events")
    .insert({
      room_id: roomId,
      host_id: userId,
      total_pi: totalPi,
      service_fee_pi: serviceFee,
      per_user_pi: perUser,
      recipient_count: recipientCount,
      status: "completed",
      txid: txid || null,
      pi_payment_id: piPaymentId || idempotencyKey || null,
    })
    .select("id,total_pi,per_user_pi,recipient_count,status")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  if (recipients.length > 0) {
    const payload = recipients.map((uid) => ({
      rain_id: rain.id,
      user_id: uid,
      amount_pi: perUser,
      claimed_at: new Date().toISOString(),
    }));
    await supabase.from("supachat_rain_recipients").insert(payload);
  }

  await supabase.from("supachat_room_messages").insert({
    room_id: roomId,
    sender_id: userId,
    content: `🌧️ Scattered π${totalPi}. Each member gets π${perUser}`,
    type: "system",
    metadata: { rain_id: rain.id, total_pi: totalPi, per_user_pi: perUser },
  });
  await supabase.from("supachat_revenue").insert({
    type: "rain_fee",
    source_id: rain.id,
    amount_pi: serviceFee,
  });

  if (recipients.length > 0) {
    const notifRows = recipients.map((uid) => ({
      user_id: uid,
      title: "Pi Rain received",
      message: `🌧️ You received π${perUser} from Pi Rain`,
      link: `/supachat/room/${roomId}`,
      type: "supachat_rain",
      dedupe_key: `supachat-rain-${rain.id}-${uid}`,
      metadata: { rain_id: rain.id, room_id: roomId, amount_pi: perUser, host_id: userId },
    }));
    await supabase.from("notifications").upsert(notifRows, { onConflict: "dedupe_key" });
  }

  return NextResponse.json({ success: true, data: rain });
}
