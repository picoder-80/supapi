"use client";

// hooks/usePiPayment.ts

import { useState } from "react";
import { createPiPayment } from "@/lib/pi/sdk";

interface PaymentOptions {
  amountPi: number;
  memo: string;
  type: "listing" | "gig" | "course" | "stay" | "game";
  referenceId: string;
  metadata?: Record<string, unknown>;
  onSuccess?: (paymentId: string, txid: string) => void;
  onCancel?: () => void;
  onError?: (err: Error) => void;
}

export function usePiPayment() {
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (opts: PaymentOptions) => {
    setIsPaying(true);
    setError(null);

    createPiPayment(
      {
        amount: opts.amountPi,
        memo: opts.memo,
        metadata: {
          type: opts.type,
          referenceId: opts.referenceId,
          ...opts.metadata,
        },
      },
      {
        onReadyForServerApproval: async (paymentId) => {
          try {
            const res = await fetch("/api/payments/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentId,
                type: opts.type,
                referenceId: opts.referenceId,
                amountPi: opts.amountPi,
                memo: opts.memo,
              }),
            });

            if (!res.ok) throw new Error("Approve gagal");
          } catch (err) {
            setError("Failed to approve payment");
            console.error(err);
          }
        },

        onReadyForServerCompletion: async (paymentId, txid) => {
          try {
            const res = await fetch("/api/payments/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId, txid }),
            });

            if (!res.ok) throw new Error("Complete gagal");

            opts.onSuccess?.(paymentId, txid);
          } catch (err) {
            setError("Failed to complete payment");
            console.error(err);
          } finally {
            setIsPaying(false);
          }
        },

        onCancel: (paymentId) => {
          console.log("[Payment] Cancelled:", paymentId);
          setIsPaying(false);
          opts.onCancel?.();
        },

        onError: (err) => {
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
