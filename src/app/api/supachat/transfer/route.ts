import { NextRequest, NextResponse } from "next/server";
import { executeOwnerTransfer, isOwnerTransferConfigured } from "@/lib/pi/payout";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";
import { applyReferralCommissionForSettlement } from "@/lib/referral/commission";

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const receiverId = String(body.receiverId ?? "");
  const conversationId = String(body.conversationId ?? "");
  const roomId = body.roomId ? String(body.roomId) : null;
  const note = String(body.note ?? "");
  const amountPi = Number(body.amountPi ?? 0);
  const idempotencyKey = String(body.idempotencyKey ?? "").trim();
  const txid = String(body.txid ?? "").trim();
  const piPaymentId = String(body.pi_payment_id ?? "").trim();

  if (!receiverId || amountPi <= 0) {
    return NextResponse.json({ success: false, error: "receiverId and positive amountPi required" }, { status: 400 });
  }
  if (!conversationId && !roomId) {
    return NextResponse.json({ success: false, error: "conversationId or roomId required" }, { status: 400 });
  }
  if (!txid || !piPaymentId) {
    return NextResponse.json({ success: false, error: "Payment proof required (txid, pi_payment_id)" }, { status: 400 });
  }

  const supabase = getSupaChatAdminClient();
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("supachat_transfers")
      .select("id,txid,status,gross_pi,net_pi,commission_pi")
      .eq("sender_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) return NextResponse.json({ success: true, data: existing, idempotent: true });
  }

  const { data: config } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "supachat_transfer_commission_pct")
    .single();
  const commissionPct = Math.min(50, Math.max(0, parseFloat(config?.value ?? "2") || 2));
  const commissionPi = Number((amountPi * (commissionPct / 100)).toFixed(7));
  const netPi = Number((amountPi - commissionPi).toFixed(7));

  // Pi A2U requires recipient to have pi_uid AND activated wallet. Check before creating transfer.
  if (isOwnerTransferConfigured() && netPi > 0) {
    const { data: receiver } = await supabase
      .from("users")
      .select("pi_uid, wallet_address, wallet_verified")
      .eq("id", receiverId)
      .single();
    const r = receiver as { pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } | null;
    const uid = r?.pi_uid?.trim();
    const hasActivatedWallet = !!(r?.wallet_address?.trim()) || !!r?.wallet_verified;
    if (!uid || !hasActivatedWallet) {
      return NextResponse.json({
        success: false,
        error: "Recipient must sign in with Pi and activate their wallet to receive payments.",
      }, { status: 400 });
    }
  }

  const { data: transfer, error } = await supabase
    .from("supachat_transfers")
    .insert({
      conversation_id: conversationId || null,
      room_id: roomId,
      sender_id: userId,
      receiver_id: receiverId,
      gross_pi: amountPi,
      commission_pct: commissionPct,
      commission_pi: commissionPi,
      net_pi: netPi,
      status: "completed",
      txid: txid || null,
      pi_payment_id: piPaymentId || null,
      idempotency_key: idempotencyKey || null,
    })
    .select("id,gross_pi,net_pi,commission_pi,status,txid,pi_payment_id")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // A2U: send Pi to recipient — guna pi_uid (disokong pi-backend) atau wallet_address (custom API)
  let payoutTxid: string | null = null;
  if (isOwnerTransferConfigured() && netPi > 0) {
    const { data: receiver } = await supabase
      .from("users")
      .select("pi_uid, wallet_address")
      .eq("id", receiverId)
      .single();
    const r = receiver as { pi_uid?: string; wallet_address?: string } | null;
    const uid = r?.pi_uid?.trim();
    const wallet = r?.wallet_address?.trim();
    if (uid || wallet) {
      const tx = await executeOwnerTransfer({
        amountPi: netPi,
        recipientUid: uid || undefined,
        destinationWallet: wallet || undefined,
        note: note || `SupaChat transfer #${transfer.id.slice(0, 8)}`,
      });
      if (tx.ok && tx.txid) {
        payoutTxid = tx.txid;
        await supabase
          .from("supachat_transfers")
          .update({ payout_txid: payoutTxid })
          .eq("id", transfer.id);
      }
    }
  }

  if (conversationId) {
    await supabase.from("supachat_messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: note || `Pi transfer π${netPi}`,
      type: "pi_transfer",
      metadata: {
        transfer_id: transfer.id,
        gross_pi: amountPi,
        net_pi: netPi,
        commission_pi: commissionPi,
        receiver_id: receiverId,
      },
      is_read: false,
    });
    await supabase
      .from("supachat_conversations")
      .update({ last_message: `💸 Sent π${netPi}`, last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  await supabase.from("supachat_revenue").insert({
    type: "transfer_commission",
    source_id: transfer.id,
    amount_pi: commissionPi,
  });
  if (commissionPi > 0) {
    await applyReferralCommissionForSettlement({
      buyerUserId: userId,
      platform: "supachat_transfer",
      platformFeePi: commissionPi,
      settlementId: transfer.id,
    });
  }

  const { data: sender } = await supabase
    .from("users")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  await supabase.from("notifications").upsert(
    {
      user_id: receiverId,
      title: `Pi received from ${sender?.username ?? "Pioneer"}`,
      message: `💰 ${sender?.username ?? "Someone"} sent you π${netPi}`,
      link: conversationId ? `/supachat/dm/${conversationId}` : "/supachat",
      type: "supachat_transfer",
      dedupe_key: `supachat-transfer-${transfer.id}`,
      metadata: { transfer_id: transfer.id, net_pi: netPi, sender_id: userId },
    },
    { onConflict: "dedupe_key" }
  );

  return NextResponse.json({ success: true, data: transfer });
}
