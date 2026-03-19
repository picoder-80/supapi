"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ReferralWithdraw.module.css";

interface WithdrawData {
  claimable_pi:   number;
  pending_pi:     number;
  claimable_date: string | null;
  hold_days:      number;
  history:        Withdrawal[];
  claimable_ids:  string[];
}

interface Withdrawal {
  id:         string;
  amount_pi:  number;
  pi_txid:    string | null;
  status:     string;
  created_at: string;
  note:       string | null;
}



const STATUS_COLOR: Record<string, string> = {
  completed: "#27ae60",
  pending:   "#f39c12",
  cancelled: "#e74c3c",
  failed:    "#e74c3c",
};

const STATUS_ICON: Record<string, string> = {
  completed: "✅",
  pending:   "⏳",
  cancelled: "❌",
  failed:    "❌",
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function daysUntil(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return Math.max(0, d);
}

export default function ReferralWithdraw() {
  const [data, setData]         = useState<WithdrawData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep]         = useState<"confirm" | "processing" | "success" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");
  const [txid, setTxid]         = useState("");

  const token = () => localStorage.getItem("supapi_token") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/referral/withdraw", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) setData(d.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleWithdraw = async () => {
    if (!data || data.claimable_pi <= 0) return;
    setStep("processing");
    const amount = Math.floor(data.claimable_pi * 1000) / 1000; // round down to 3dp
    const r = await fetch("/api/referral/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ amount }),
    });
    const d = await r.json();
    if (d?.success) {
      setTxid(String(d?.data?.pi_txid ?? ""));
      setStep("success");
      load();
      return;
    }
    setErrorMsg(d?.error ?? "Withdrawal failed");
    setStep("error");
  };

  const openModal = () => {
    setStep("confirm");
    setErrorMsg("");
    setTxid("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (step === "processing") return; // prevent close during Pi approval
    setShowModal(false);
    if (step === "success") load();
  };

  if (loading) return <div className={styles.skeleton} />;
  if (!data)   return null;

  const canWithdraw  = data.claimable_pi >= 1;
  const hasPending   = data.pending_pi > 0;

  return (
    <div className={styles.wrap}>

      {/* Balance card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceRow}>
          <div className={styles.balanceItem}>
            <div className={styles.balanceVal} style={{ color: canWithdraw ? "#27ae60" : "var(--color-text)" }}>
              {data.claimable_pi.toFixed(4)}π
            </div>
            <div className={styles.balanceLabel}>Claimable</div>
          </div>
          <div className={styles.balanceDivider} />
          <div className={styles.balanceItem}>
            <div className={styles.balanceVal} style={{ color: "#f39c12" }}>
              {data.pending_pi.toFixed(4)}π
            </div>
            <div className={styles.balanceLabel}>In Hold ({data.hold_days}d)</div>
          </div>
        </div>

        {hasPending && data.claimable_date && (
          <div className={styles.holdNote}>
            ⏳ Next release in <b>{daysUntil(data.claimable_date)} days</b>
          </div>
        )}

        {!canWithdraw && data.claimable_pi > 0 && (
          <div className={styles.minNote}>
            Minimum withdrawal is <b>1π</b> — you have {data.claimable_pi.toFixed(4)}π claimable.
          </div>
        )}

        <button
          className={styles.withdrawBtn}
          onClick={openModal}
          disabled={!canWithdraw}
        >
          {canWithdraw ? `💸 Withdraw ${data.claimable_pi.toFixed(4)}π` : "Not enough to withdraw yet"}
        </button>
      </div>

      {/* History */}
      {data.history.length > 0 && (
        <div className={styles.history}>
          <div className={styles.historyTitle}>Withdrawal History</div>
          {data.history.map(w => (
            <div key={w.id} className={styles.historyRow}>
              <div className={styles.historyIcon}>{STATUS_ICON[w.status] ?? "💳"}</div>
              <div className={styles.historyInfo}>
                <div className={styles.historyAmt}>{Number(w.amount_pi).toFixed(4)}π</div>
                <div className={styles.historyMeta}>
                  {timeAgo(w.created_at)}
                  {w.pi_txid && <span className={styles.txid}> · {w.pi_txid.slice(0, 12)}...</span>}
                </div>
              </div>
              <div className={styles.historyStatus} style={{ color: STATUS_COLOR[w.status] ?? "var(--color-text-muted)" }}>
                {w.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Withdraw modal */}
      {showModal && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>

            {step === "confirm" && (
              <>
                <div className={styles.modalTitle}>💸 Withdraw Commission</div>
                <div className={styles.modalBody}>
                  <div className={styles.modalAmount}>{data.claimable_pi.toFixed(4)}π</div>
                  <div className={styles.modalSub}>will be sent to your Pi wallet</div>
                  <div className={styles.modalInfo}>
                    <div className={styles.modalInfoRow}>
                      <span>Amount</span><span>{data.claimable_pi.toFixed(4)}π</span>
                    </div>
                    <div className={styles.modalInfoRow}>
                      <span>Destination</span><span>Your Pi Wallet</span>
                    </div>
                    <div className={styles.modalInfoRow}>
                      <span>Network fee</span><span>Covered by Supapi</span>
                    </div>
                  </div>
                  <p className={styles.modalNote}>
                    This withdrawal will be sent automatically via A2U to your linked Pi wallet.
                  </p>
                </div>
                <div className={styles.modalBtns}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                  <button className={styles.confirmBtn} onClick={handleWithdraw}>
                    Confirm & Withdraw
                  </button>
                </div>
              </>
            )}

            {step === "processing" && (
              <>
                <div className={styles.modalTitle}>Processing...</div>
                <div className={styles.modalBody}>
                  <div className={styles.spinner} />
                  <div className={styles.processingText}>
                    Sending withdrawal via A2U.<br />
                    Please wait a few seconds.
                  </div>
                </div>
              </>
            )}

            {step === "success" && (
              <>
                <div className={styles.modalTitle}>Withdrawal Successful! 🎉</div>
                <div className={styles.modalBody}>
                  <div className={styles.successIcon}>✅</div>
                  <div className={styles.modalAmount}>{data.claimable_pi.toFixed(4)}π</div>
                  <div className={styles.modalSub}>has been sent to your Pi wallet</div>
                  {txid && <div className={styles.txidFull}>TX: {txid}</div>}
                </div>
                <div className={styles.modalBtns}>
                  <button className={styles.confirmBtn} onClick={closeModal}>Done</button>
                </div>
              </>
            )}

            {step === "error" && (
              <>
                <div className={styles.modalTitle}>Withdrawal Failed</div>
                <div className={styles.modalBody}>
                  <div className={styles.errorIcon}>❌</div>
                  <div className={styles.errorMsg}>{errorMsg}</div>
                </div>
                <div className={styles.modalBtns}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Close</button>
                  <button className={styles.confirmBtn} onClick={() => setStep("confirm")}>Try Again</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}