type OwnerTransferInput = {
  amountPi: number;
  destinationWallet?: string;
  recipientUid?: string;
  note?: string | null;
};

type OwnerTransferResult = {
  ok: boolean;
  provider: "custom_api" | "unconfigured";
  txid?: string;
  message?: string;
  raw?: unknown;
};

export function isOwnerTransferConfigured(): boolean {
  return Boolean(process.env.PI_PAYOUT_API_URL && process.env.PI_PAYOUT_API_KEY);
}

export async function executeOwnerTransfer(input: OwnerTransferInput): Promise<OwnerTransferResult> {
  const endpoint = process.env.PI_PAYOUT_API_URL;
  const apiKey = process.env.PI_PAYOUT_API_KEY;

  if (!endpoint || !apiKey) {
    return {
      ok: false,
      provider: "unconfigured",
      message: "Execute transfer not configured. Set PI_PAYOUT_API_URL and PI_PAYOUT_API_KEY.",
    };
  }

  const uid = input.recipientUid?.trim();
  const wallet = input.destinationWallet?.trim();
  if (!uid && !wallet) {
    return {
      ok: false,
      provider: "custom_api",
      message: "Either recipientUid or destinationWallet required",
    };
  }

  try {
    const body: Record<string, unknown> = {
      amount_pi: input.amountPi,
      note: input.note ?? "",
    };
    if (uid) body.recipient_uid = uid;
    if (wallet) body.destination_wallet = wallet;

    console.error("[Payout] Request:", { endpoint, amount_pi: body.amount_pi, has_recipient_uid: !!uid, has_destination_wallet: !!wallet });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMsg = String((payload as any)?.error ?? (payload as any)?.message ?? (payload as any)?.detail ?? "").trim();
      const msg = apiMsg
        ? `Transfer API failed (${response.status}): ${apiMsg}`
        : `Transfer API failed (${response.status})`;
      console.error("[Payout] Transfer API error:", { status: response.status, payload, endpoint });
      console.error("[Payout] Response body:", JSON.stringify(payload));
      return {
        ok: false,
        provider: "custom_api",
        message: msg,
        raw: payload,
      };
    }

    const txid = String((payload as any)?.txid ?? (payload as any)?.transaction_id ?? "").trim();
    if (!txid) {
      return {
        ok: false,
        provider: "custom_api",
        message: "Transfer API response missing txid",
        raw: payload,
      };
    }

    return { ok: true, provider: "custom_api", txid, raw: payload };
  } catch (error: any) {
    return {
      ok: false,
      provider: "custom_api",
      message: error?.message ?? "Transfer API request failed",
    };
  }
}
