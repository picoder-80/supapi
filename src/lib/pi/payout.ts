type OwnerTransferInput = {
  amountPi: number;
  destinationWallet: string;
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

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        asset: "PI",
        amount_pi: input.amountPi,
        destination_wallet: input.destinationWallet,
        note: input.note ?? "",
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        provider: "custom_api",
        message: `Transfer API failed (${response.status})`,
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
