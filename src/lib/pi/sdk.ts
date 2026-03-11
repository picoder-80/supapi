// lib/pi/sdk.ts
// Pi Network SDK wrapper — based on official SDK reference

export function isPiBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.Pi !== "undefined";
}

export function initPiSDK(): void {
  if (typeof window === "undefined") return;
  if (!window.Pi) {
    console.warn("[Supapi] Pi SDK not found. Please open in Pi Browser.");
    return;
  }

  window.Pi.init({
    version: "2.0",
    sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
  });

  console.log(`[Supapi] Pi SDK initialized — sandbox: ${process.env.NEXT_PUBLIC_PI_SANDBOX}`);
}

export async function authenticateWithPi() {
  if (!isPiBrowser()) {
    throw new Error("Please open in Pi Browser to sign in.");
  }

  return window.Pi.authenticate(
    ["username", "payments", "wallet_address"],
    onIncompletePaymentFound
  );
}

// Called every time user authenticates if incomplete payment exists
async function onIncompletePaymentFound(payment: {
  identifier: string;
  transaction?: { txid: string; _link: string } | null;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
}) {
  console.warn("[Supapi] Incomplete payment found:", payment.identifier);

  try {
    await fetch("/api/payments/incomplete", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ payment }),
    });
  } catch (err) {
    console.error("[Supapi] Failed to handle incomplete payment:", err);
  }
}

// ✅ FIX: Re-authenticate with payments scope BEFORE createPayment
// Pi SDK v2 REQUIRES authenticate() with "payments" scope before createPayment()
// Skipping this step causes: "Cannot create a payment without paymentData"
export async function ensurePaymentReady(): Promise<void> {
  if (!isPiBrowser()) throw new Error("Pi Browser is required to make payments.");

  await window.Pi.authenticate(
    ["username", "payments", "wallet_address"],
    async (incompletePayment) => {
      console.warn("[Supapi] Incomplete payment found during payment auth:", incompletePayment.identifier);
      try {
        await fetch("/api/payments/incomplete", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ payment: incompletePayment }),
        });
      } catch (err) {
        console.error("[Supapi] Failed to handle incomplete payment:", err);
      }
    }
  );
}

export function createPiPayment(
  data: { amount: number; memo: string; metadata: object },
  callbacks: {
    onReadyForServerApproval:    (paymentId: string) => void;
    onReadyForServerCompletion:  (paymentId: string, txid: string) => void;
    onCancel:                    (paymentId: string) => void;
    onError:                     (error: Error, payment?: unknown) => void;
  }
): void {
  if (!isPiBrowser()) {
    throw new Error("Pi Browser is required to make payments.");
  }

  window.Pi.createPayment(data, callbacks);
}

// ✅ Updated to use Pi.Ads.showAd() per official SDK docs
export async function showPiAd(
  type: "interstitial" | "rewarded" = "rewarded"
): Promise<{ type: string; result: string; adId?: string }> {
  if (!isPiBrowser()) {
    throw new Error("Pi Browser is required for ads.");
  }

  return window.Pi.Ads.showAd(type);
}

export async function isPiAdReady(
  type: "interstitial" | "rewarded"
): Promise<boolean> {
  if (!isPiBrowser()) return false;
  const res = await window.Pi.Ads.isAdReady(type);
  return res.ready;
}

export async function requestPiAd(
  type: "interstitial" | "rewarded"
): Promise<string> {
  if (!isPiBrowser()) throw new Error("Pi Browser required");
  const res = await window.Pi.Ads.requestAd(type);
  return res.result;
}

export function shareToPi(title: string, message: string): void {
  if (!isPiBrowser()) return;
  window.Pi.openShareDialog(title, message);
}

export async function openInSystemBrowser(url: string): Promise<void> {
  if (!isPiBrowser()) {
    window.open(url, "_blank");
    return;
  }
  return window.Pi.openUrlInSystemBrowser(url);
}
