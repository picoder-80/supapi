// lib/pi/payments.ts
// Server-side Pi payment operations

const PI_API_BASE = "https://api.minepi.com";

// Lazy getter — avoid "Key undefined" at build time
function getPiHeaders() {
  const key = process.env.PI_API_KEY;
  if (!key) throw new Error("PI_API_KEY is not set");
  return {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
  };
}

// Approve payment — called from onReadyForServerApproval
export async function approvePayment(paymentId: string): Promise<boolean> {
  try {
    const res = await fetch(`${PI_API_BASE}/v2/payments/${paymentId}/approve`, {
      method:  "POST",
      headers: getPiHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Pi] Approve failed:", res.status, err);
      return false;
    }

    console.log("[Pi] Payment approved:", paymentId);
    return true;
  } catch (err) {
    console.error("[Pi] Approve error:", err);
    return false;
  }
}

// Complete payment — called from onReadyForServerCompletion
export async function completePayment(paymentId: string, txid: string): Promise<boolean> {
  try {
    const res = await fetch(`${PI_API_BASE}/v2/payments/${paymentId}/complete`, {
      method:  "POST",
      headers: getPiHeaders(),
      body:    JSON.stringify({ txid }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Pi] Complete failed:", res.status, err);
      return false;
    }

    console.log("[Pi] Payment completed:", paymentId, txid);
    return true;
  } catch (err) {
    console.error("[Pi] Complete error:", err);
    return false;
  }
}

// Get payment details
export async function getPayment(paymentId: string) {
  try {
    const res = await fetch(`${PI_API_BASE}/v2/payments/${paymentId}`, {
      headers: getPiHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Verify Pi user access token
export async function verifyPiUser(accessToken: string) {
  try {
    const res = await fetch(`${PI_API_BASE}/v2/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}