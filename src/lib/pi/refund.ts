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
  const apiKey = process.env.PI_API_KEY;
  if (!apiKey) throw new Error("PI_API_KEY is not configured");
  if (!process.env.PI_TREASURY_UID) {
    throw new Error("PI_TREASURY_UID is not configured");
  }
  if (!buyerUid?.trim()) throw new Error("Buyer Pi UID is required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid refund amount");

  const body = {
    payment: {
      amount: Number(amount.toFixed(7)),
      uid: buyerUid.trim(),
      memo: `Supapi dispute refund #${disputeId.slice(0, 8)}`,
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

