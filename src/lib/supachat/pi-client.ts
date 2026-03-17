"use client";

import { createPiPayment, ensurePaymentReady, getApiBase } from "@/lib/pi/sdk";

type StartSupaChatPaymentArgs = {
  amountPi: number;
  memo: string;
  token: string;
  metadata?: Record<string, unknown>;
  onCompleted: (ctx: { paymentId: string; txid: string }) => Promise<void> | void;
  onCancelled?: () => void;
  onError?: (error: Error) => void;
};

export async function startSupaChatPayment(args: StartSupaChatPaymentArgs) {
  await ensurePaymentReady();
  const base = getApiBase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
  };
  return new Promise<void>((resolve, reject) => {
    createPiPayment(
      {
        amount: args.amountPi,
        memo: args.memo,
        metadata: {
          platform: "supachat",
          ...(args.metadata ?? {}),
        },
      },
      {
        onReadyForServerApproval: async (paymentId: string) => {
          const res = await fetch(`${base || ""}/api/supachat/payments/approve`, {
            method: "POST",
            headers,
            body: JSON.stringify({ paymentId }),
          });
          const json = await res.json().catch(() => ({}));
          if (!json?.success) {
            throw new Error(json?.error ?? "Pi approval failed");
          }
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          try {
            const completeRes = await fetch(`${base || ""}/api/supachat/payments/complete`, {
              method: "POST",
              headers,
              body: JSON.stringify({ paymentId, txid }),
            });
            const completeJson = await completeRes.json();
            if (!completeJson.success) throw new Error(completeJson.error ?? "Pi completion failed");
            await args.onCompleted({ paymentId, txid });
            resolve();
          } catch (error: any) {
            const err = new Error(error?.message ?? "Payment completion failed");
            args.onError?.(err);
            reject(err);
          }
        },
        onCancel: () => {
          args.onCancelled?.();
          resolve();
        },
        onError: (err: Error) => {
          args.onError?.(err);
          reject(err);
        },
      }
    );
  });
}
