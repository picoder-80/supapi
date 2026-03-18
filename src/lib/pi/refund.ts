import { executeOwnerTransfer, isOwnerTransferConfigured } from "./payout";

type RefundResult = {
  success: true;
  paymentId: string;
  txid: string | null;
};

function parseA2UResponse(payload: any): { paymentId: string; txid: string | null } {
  const payment = payload?.payment ?? payload?.data?.payment ?? payload;
  const paymentId = String(
    payment?.identifier ??
      payment?.id ??
      payment?.paymentId ??
      payload?.paymentId ??
      ""
  ).trim();
  const txidRaw =
    payment?.transaction?.txid ??
    payment?.txid ??
    payload?.txid ??
    payload?.transaction?.txid ??
    null;
  const txid = txidRaw ? String(txidRaw) : null;
  if (!paymentId) throw new Error("A2U response missing payment identifier");
  return { paymentId, txid };
}

export async function issueA2URefund(
  buyerUid: string,
  amount: number,
  disputeId: string,
  orderId: string
): Promise<RefundResult> {
  if (!buyerUid?.trim()) throw new Error("Buyer Pi UID is required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid refund amount");

  const amountRounded = Number(amount.toFixed(7));
  const note = `Supapi dispute refund #${disputeId.slice(0, 8)}`;

  const payoutConfigured = isOwnerTransferConfigured();
  // #region agent log
  fetch('http://127.0.0.1:7583/ingest/85ab3f18-cb22-483f-9206-fdd2fd446d94',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9e0db8'},body:JSON.stringify({sessionId:'9e0db8',location:'refund.ts:config-check',message:'Payout config',data:{payoutConfigured,hasPiApiKey:!!process.env.PI_API_KEY,hasTreasuryUid:!!process.env.PI_TREASURY_UID},hypothesisId:'D',timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // Prefer payout service (same as SupaChat, SupaScrow) — no PI_TREASURY_UID needed
  if (payoutConfigured) {
    const tx = await executeOwnerTransfer({
      amountPi: amountRounded,
      recipientUid: buyerUid.trim(),
      note,
    });
    // #region agent log
    fetch('http://127.0.0.1:7583/ingest/85ab3f18-cb22-483f-9206-fdd2fd446d94',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9e0db8'},body:JSON.stringify({sessionId:'9e0db8',location:'refund.ts:executeOwnerTransfer-result',message:'Transfer result',data:{ok:tx.ok,message:tx.message,txid:tx.txid},hypothesisId:'E',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!tx.ok) {
      throw new Error(tx.message ?? "Payout service refund failed");
    }
    return {
      success: true,
      paymentId: tx.txid ?? `refund-${disputeId}-${Date.now()}`,
      txid: tx.txid ?? null,
    };
  }

  // Fallback: direct Pi API (requires PI_API_KEY + PI_TREASURY_UID)
  const apiKey = process.env.PI_API_KEY;
  if (!apiKey) throw new Error("PI_API_KEY is not configured");
  if (!process.env.PI_TREASURY_UID) {
    throw new Error(
      "Pi payout not configured. Set PI_PAYOUT_API_URL and PI_PAYOUT_API_KEY (recommended), or PI_TREASURY_UID for direct Pi API refunds."
    );
  }

  const body = {
    payment: {
      amount: amountRounded,
      uid: buyerUid.trim(),
      memo: note,
      metadata: {
        platform: "supamarket",
        dispute_id: disputeId,
        order_id: orderId,
        treasury_uid: process.env.PI_TREASURY_UID,
        reason: "buyer_favour_refund",
      },
    },
  };

  const response = await fetch("https://api.minepi.com/v2/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      String(payload?.error ?? payload?.message ?? "").trim() ||
      `A2U request failed (${response.status})`;
    throw new Error(msg);
  }

  const { paymentId, txid } = parseA2UResponse(payload);
  return { success: true, paymentId, txid };
}

