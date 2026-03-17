import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";

const PRICE_BY_DAYS: Record<number, number> = {
  1: 10,
  3: 25,
  7: 60,
};

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const roomId = String(body.roomId ?? "");
  const days = Number(body.days ?? 1);
  if (!roomId || !PRICE_BY_DAYS[days]) {
    return NextResponse.json({ success: false, error: "Valid roomId and days required (1/3/7)" }, { status: 400 });
  }

  const supabase = getSupaChatAdminClient();
  const { data: membership } = await supabase
    .from("supachat_room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership || membership.role !== "host") {
    return NextResponse.json({ success: false, error: "Only room host can promote room" }, { status: 403 });
  }

  const amountPi = PRICE_BY_DAYS[days];
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

  const { data: promo, error } = await supabase
    .from("supachat_promotions")
    .insert({
      room_id: roomId,
      purchased_by: userId,
      days,
      amount_pi: amountPi,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      pi_payment_id: body.pi_payment_id ?? null,
      txid: body.txid ?? null,
    })
    .select("id,room_id,days,amount_pi,starts_at,ends_at")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase
    .from("supachat_rooms")
    .update({ is_promoted: true, promoted_until: endsAt.toISOString() })
    .eq("id", roomId);
  await supabase.from("supachat_revenue").insert({
    type: "promoted",
    source_id: promo.id,
    amount_pi: amountPi,
  });

  return NextResponse.json({ success: true, data: promo });
}
