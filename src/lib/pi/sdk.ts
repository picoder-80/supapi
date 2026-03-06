// lib/pi/sdk.ts
// Pi Network SDK wrapper

import type { PiAuthResult, PiPaymentData, PiPaymentCallbacks } from "@/types/pi.d";

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

export async function authenticateWithPi(): Promise<PiAuthResult> {
  if (!isPiBrowser()) {
    throw new Error("Please open in Pi Browser to sign in.");
  }

  return window.Pi.authenticate(["username", "payments"], handleIncompletePayment);
}

async function handleIncompletePayment(
  payment: Parameters<Parameters<typeof window.Pi.authenticate>[1]>[0]
) {
  console.warn("[Supapi] Incomplete payment found:", payment.identifier);

  try {
    await fetch("/api/payments/incomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: payment.identifier }),
    });
  } catch (err) {
    console.error("[Supapi] Failed to handle incomplete payment:", err);
  }
}

export function createPiPayment(data: PiPaymentData, callbacks: PiPaymentCallbacks): void {
  if (!isPiBrowser()) {
    throw new Error("Pi Browser is required to make payments.");
  }

  window.Pi.createPayment(data, callbacks);
}

export async function showPiAd(
  type: "interstitial" | "rewarded" = "rewarded"
): Promise<{ result: string }> {
  if (!isPiBrowser()) {
    throw new Error("Pi Browser is required for ads.");
  }

  return window.Pi.showAd(type);
}

export function shareToPi(title: string, message: string): void {
  if (!isPiBrowser()) return;
  window.Pi.openShareDialog(title, message);
}
