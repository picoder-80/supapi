"use client";

// app/test-payment/page.tsx
// TEMPORARY — for Pi Developer Portal Step 10 verification only
// Pi gives 60 seconds to complete payment after user confirms — don't close the page.
// When embedded in Pi Sandbox (sandbox.minepi.com), fetch("/api/...") goes to Pi, not our server —
// so we must use absolute backend URL for approve/complete.

import { useState } from "react";
import { getApiBase } from "@/lib/pi/sdk";
import styles from "./page.module.css";

const PAYMENT_DEADLINE_SEC = 60;

type PaymentStatus = "idle" | "waiting" | "approved" | "completed" | "error";

export default function TestPaymentPage() {
  const [status,  setStatus]  = useState<PaymentStatus>("idle");
  const [message, setMessage] = useState("");
  const [txid,    setTxid]    = useState("");

  // ✅ FIX: async — must await authenticate() with payments scope FIRST
  const handlePay = async () => {
    if (!window.Pi) {
      setStatus("error");
      setMessage("Pi SDK not found. Please open in Pi Browser.");
      return;
    }

    setStatus("waiting");
    setMessage("Authenticating with Pi...");

    // ✅ FIX: Re-authenticate with payments scope before createPayment
    // Pi SDK v2 REQUIRES this step — skipping causes "Cannot create a payment without paymentData"
    try {
      await window.Pi.authenticate(
        ["username", "payments", "wallet_address"],
        async (incompletePayment) => {
          console.warn("[TestPayment] Incomplete payment found:", incompletePayment.identifier);
          const base = getApiBase();
          await fetch(`${base || ""}/api/payments/incomplete`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ payment: incompletePayment }),
          }).catch(console.error);
        }
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Auth failed";
      setStatus("error");
      setMessage(`Authentication failed: ${msg}`);
      return;
    }

    setMessage("Waiting for Pi Browser confirmation...");

    window.Pi.createPayment(
      {
        amount:   0.001,
        memo:     "Supapi test payment — Step 10 verification",
        metadata: { type: "test", step: 10 },
      },
      {
        // ✅ Fire-and-forget — uses /test-approve (no auth needed)
        onReadyForServerApproval: (paymentId: string) => {
          setMessage("Approving payment...");
          const base = getApiBase();
          const approveUrl = `${base || ""}/api/payments/test-approve`;
          fetch(approveUrl, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ paymentId }),
          })
            .then((res) => res.text())
            .then((raw) => {
              let data: { success?: boolean; error?: string };
              try {
                data = JSON.parse(raw);
              } catch {
                throw new Error("Invalid response from server");
              }
              if (!data.success) throw new Error(data.error ?? "Approve failed");
              setStatus("approved");
              setMessage("Approved! Confirm in Pi Browser...");
            })
            .catch((err: Error) => {
              const msg = err.message;
              const isNetwork = /failed to fetch|network error|cors/i.test(msg);
              setStatus("error");
              setMessage(
                isNetwork
                  ? `Rangkaian gagal. Pastikan NEXT_PUBLIC_APP_URL & CORS. URL: ${approveUrl}`
                  : `Approve failed: ${msg}`
              );
            });
        },

        // ✅ Complete within PAYMENT_DEADLINE_SEC (60s) — retry on transient failure
        onReadyForServerCompletion: async (paymentId: string, txId: string) => {
          setMessage("Completing payment...");
          const maxAttempts = 5;
          const delayMs = 2000;
          const base = getApiBase();
          const completeUrl = `${base || ""}/api/payments/test-complete`;
          let lastError: Error | null = null;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              const res = await fetch(completeUrl, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ paymentId, txid: txId }),
              });
              const raw = await res.text();
              let data: { success?: boolean; error?: string };
              try {
                data = JSON.parse(raw);
              } catch {
                throw new Error(res.ok ? "Invalid response" : `HTTP ${res.status}: ${raw.slice(0, 80)}`);
              }
              if (!data.success) throw new Error(data.error ?? "Complete failed");
              setStatus("completed");
              setTxid(txId);
              setMessage("Payment completed successfully! ✅");
              return;
            } catch (err: unknown) {
              lastError = err instanceof Error ? err : new Error("Unknown error");
              setMessage(`Completing... (cuba ${attempt}/${maxAttempts})`);
              if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, delayMs));
            }
          }
          const msg = lastError?.message ?? "Unknown";
          const isNetwork = /failed to fetch|network error|cors/i.test(msg);
          setStatus("error");
          setMessage(
            isNetwork
              ? `Rangkaian gagal (${msg}). Pastikan NEXT_PUBLIC_APP_URL diset dan backend allow CORS. URL: ${completeUrl}`
              : `Complete failed: ${msg}. Sila hubungi developer.`
          );
        },

        onCancel: (paymentId: string) => {
          console.log("[Test] Cancelled:", paymentId);
          setStatus("idle");
          setMessage("Payment cancelled.");
        },

        onError: (error: Error, payment?: unknown) => {
          console.error("[Test] Error:", error, payment);
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
          <span className={styles.amountLabel}>AMOUNT</span>
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
          {typeof window !== "undefined" && window.location.origin.includes("minepi.com") && !process.env.NEXT_PUBLIC_APP_URL && (
            <><br /><strong>Set NEXT_PUBLIC_APP_URL</strong> to your backend URL (e.g. Vercel) so approve/complete reach your server.</>
          )}
          {typeof window !== "undefined" && getApiBase() && (
            <><br /><small>API base: {getApiBase()}</small></>
          )}
        </p>
        {(status === "waiting" || status === "approved") && (
          <p className={styles.deadline}>
            ⏱ Pembayaran mesti diselesaikan dalam <strong>{PAYMENT_DEADLINE_SEC} saat</strong>. Jangan tutup halaman.
          </p>
        )}
      </div>
    </div>
  );
}
