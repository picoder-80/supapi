"use client";

// hooks/usePiPayment.ts

import { useState } from "react";
import { createPiPayment, getApiBase } from "@/lib/pi/sdk";

interface PaymentOptions {
  amountPi:    number;
  memo:        string;
  type:        "listing" | "gig" | "course" | "stay" | "game" | "supapod_tip";
  referenceId: string;
  metadata?:   Record<string, unknown>;
  onSuccess?:  (paymentId: string, txid: string) => void;
  onCancel?:   () => void;
  onError?:    (err: Error) => void;
}

export function usePiPayment() {
  const [isPaying, setIsPaying] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const pay = (opts: PaymentOptions) => {
    setIsPaying(true);
    setError(null);

    createPiPayment(
      {
        amount:   opts.amountPi,
        memo:     opts.memo,
        metadata: {
          type:        opts.type,
          referenceId: opts.referenceId,
          ...opts.metadata,
        },
      },
      {
        // ✅ FIRE AND FORGET — do NOT await, Pi Browser needs to proceed immediately
        onReadyForServerApproval: (paymentId: string) => {
          console.log("[Payment] onReadyForServerApproval:", paymentId);
          const base = getApiBase();
          fetch(`${base || ""}/api/payments/approve`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentId,
              type:        opts.type,
              referenceId: opts.referenceId,
              amountPi:    opts.amountPi,
              memo:        opts.memo,
            }),
          }).catch((err) => console.error("[Payment] Approve fetch error:", err));
        },

        // ✅ Can await here — user already confirmed, waiting for completion
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          console.log("[Payment] onReadyForServerCompletion:", paymentId, txid);
          try {
            const base = getApiBase();
            const res = await fetch(`${base || ""}/api/payments/complete`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ paymentId, txid }),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error ?? "Complete failed");

            opts.onSuccess?.(paymentId, txid);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Payment completion failed";
            setError(msg);
            console.error("[Payment] Complete error:", err);
          } finally {
            setIsPaying(false);
          }
        },

        onCancel: (paymentId: string) => {
          console.log("[Payment] Cancelled:", paymentId);
          setIsPaying(false);
          opts.onCancel?.();
        },

        onError: (err: Error) => {
          console.error("[Payment] Error:", err);
          setError(err.message);
          setIsPaying(false);
          opts.onError?.(err);
        },
      }
    );
  };

  return { pay, isPaying, error };
}