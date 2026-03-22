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

export type BuyerTreasuryRefundParams = {
  buyerUid: string;
  amountPi: number;
  memo: string;
  /** Extra fields for direct Pi API metadata (optional) */
  metadata?: {
    dispute_id?: string;
    order_id?: string;
    reason?: string;
  };
};

/**
 * Send Pi from platform treasury to buyer (A2U). Same plumbing as dispute refunds.
 */
export async function issueBuyerRefundFromTreasury(params: BuyerTreasuryRefundParams): Promise<RefundResult> {
  const { buyerUid, amountPi, memo, metadata } = params;
  if (!buyerUid?.trim()) throw new Error("Buyer Pi UID is required");
  if (!Number.isFinite(amountPi) || amountPi <= 0) throw new Error("Invalid refund amount");

  const amountRounded = Number(amountPi.toFixed(7));
  const payoutConfigured = isOwnerTransferConfigured();

  if (payoutConfigured) {
    const tx = await executeOwnerTransfer({
      amountPi: amountRounded,
      recipientUid: buyerUid.trim(),
      note: memo,
    });
    if (!tx.ok) {
      throw new Error(tx.message ?? "Payout service refund failed");
    }
    return {
      success: true,
      paymentId: tx.txid ?? `refund-${Date.now()}`,
      txid: tx.txid ?? null,
    };
  }

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
      memo,
      metadata: {
        platform: "supamarket",
        treasury_uid: process.env.PI_TREASURY_UID,
        ...metadata,
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

export async function issueA2URefund(
  buyerUid: string,
  amount: number,
  disputeId: string,
  orderId: string
): Promise<RefundResult> {
  return issueBuyerRefundFromTreasury({
    buyerUid,
    amountPi: amount,
    memo: `Supapi dispute refund #${disputeId.slice(0, 8)}`,
    metadata: {
      dispute_id: disputeId,
      order_id: orderId,
      reason: "buyer_favour_refund",
    },
  });
}
