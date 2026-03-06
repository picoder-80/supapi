"use client";

// app/test-payment/page.tsx
// TEMPORARY — for Pi Developer Portal Step 10 verification only

import { useState } from "react";
import styles from "./page.module.css";

type PaymentStatus = "idle" | "waiting" | "approved" | "completed" | "error";

export default function TestPaymentPage() {
  const [status,  setStatus]  = useState<PaymentStatus>("idle");
  const [message, setMessage] = useState("");
  const [txid,    setTxid]    = useState("");

  const handlePay = () => {
    if (!window.Pi) {
      setStatus("error");
      setMessage("Pi SDK not found. Please open in Pi Browser.");
      return;
    }

    setStatus("waiting");
    setMessage("Waiting for Pi Browser confirmation...");

    window.Pi.createPayment(
      {
        amount: 0.001,
        memo:   "Supapi test payment — Step 10 verification",
        metadata: { type: "test", step: 10 },
      },
      {
        // ✅ FIRE AND FORGET — must NOT be async, Pi Browser won't show
        // confirm dialog until this returns. SDK will retry every ~10s automatically.
        onReadyForServerApproval: (paymentId: string) => {
          setMessage("Approving payment...");
          fetch("/api/payments/approve", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentId,
              type:        "listing",
              referenceId: "test-step10",
              amountPi:    0.001,
              memo:        "Test payment",
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (!data.success) throw new Error(data.error);
              setStatus("approved");
              setMessage("Approved! Confirm in Pi Browser...");
            })
            .catch((err: Error) => {
              setStatus("error");
              setMessage(`Approve failed: ${err.message}`);
            });
        },

        // ✅ Can await here — user already confirmed on blockchain
        // SDK will also retry every ~10s if this fails
        onReadyForServerCompletion: async (paymentId: string, txId: string) => {
          setMessage("Completing payment...");
          try {
            const res  = await fetch("/api/payments/complete", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ paymentId, txid: txId }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setStatus("completed");
            setTxid(txId);
            setMessage("Payment completed successfully! ✅");
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            setStatus("error");
            setMessage(`Complete failed: ${msg}`);
          }
        },

        onCancel: (paymentId: string) => {
          console.log("[Test] Payment cancelled:", paymentId);
          setStatus("idle");
          setMessage("Payment cancelled.");
        },

        // ✅ onError receives (error, payment?) — payment is optional per SDK docs
        onError: (error: Error, payment?: unknown) => {
          console.error("[Test] Payment error:", error, payment);
          setStatus("error");
          setMessage(`Error: ${error.message ?? "Unknown error"}`);
        },
      }
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>π</div>
        <h1 className={styles.title}>Test Payment</h1>
        <p className={styles.sub}>Step 10 — Pi Developer Portal Verification</p>

        <div className={styles.amount}>
          <span className={styles.amountLabel}>Amount</span>
          <span className={styles.amountValue}>π 0.001</span>
          <span className={styles.amountNote}>Sandbox — no real Pi deducted</span>
        </div>

        {message && (
          <div className={`${styles.msg} ${styles[status]}`}>
            {status === "waiting"   && "⏳ "}
            {status === "approved"  && "✓ "}
            {status === "completed" && "✅ "}
            {status === "error"     && "⚠️ "}
            {message}
          </div>
        )}

        {txid && (
          <div className={styles.txid}>
            <span className={styles.txidLabel}>Transaction ID</span>
            <span className={styles.txidValue}>{txid}</span>
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={status === "waiting" || status === "approved"}
          className={`${styles.btn} ${status === "completed" ? styles.btnSuccess : ""}`}
        >
          {status === "waiting"   && "⏳ Processing..."}
          {status === "approved"  && "⏳ Confirm in Pi Browser..."}
          {status === "completed" && "✅ Payment Complete!"}
          {status === "idle"      && "Pay π 0.001 with Pi"}
          {status === "error"     && "Try Again"}
        </button>

        <p className={styles.note}>
          ⚠️ Must be opened inside <strong>Pi Browser</strong>
        </p>
      </div>
    </div>
  );
}