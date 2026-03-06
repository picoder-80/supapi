// lib/pi/payments.ts
// Server-side Pi payment operations

const PI_API_BASE = "https://api.minepi.com";
const PI_API_KEY = process.env.PI_API_KEY!;

const piHeaders = {
  Authorization: `Key ${PI_API_KEY}`,
  "Content-Type": "application/json",
};

// Approve payment — call when onReadyForServerApproval fires
export async function approvePayment(paymentId: string): Promise<boolean> {
  try {
    const res = await fetch(`${PI_API_BASE}/v2/payments/${paymentId}/approve`, {
      method: "POST",
      headers: piHeaders,
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("[Pi] Approve failed:", err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Pi] Approve error:", err);
    return false;
  }
}

// Complete payment — call when onReadyForServerCompletion fires
export async function completePayment(paymentId: string, txid: string): Promise<boolean> {
  try {
    const res = await fetch(`${PI_API_BASE}/v2/payments/${paymentId}/complete`, {
      method: "POST",
      headers: piHeaders,
      body: JSON.stringify({ txid }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("[Pi] Complete failed:", err);
      return false;
    }

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
      headers: piHeaders,
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
