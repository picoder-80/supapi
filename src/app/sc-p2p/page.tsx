"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

interface Wallet {
  balance: number;
}

interface Transaction {
  id: string;
  type: string;
  activity: string;
  amount: number;
  note: string;
  created_at: string;
}

interface UserSuggestion {
  id: string;
  username: string;
  display_name: string | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ScP2PPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferUsername, setTransferUsername] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState<UserSuggestion[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch("/api/credits", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) {
        setWallet(d.data.wallet ?? null);
        setTransactions(d.data.transactions ?? []);
      }
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, fetchData]);

  useEffect(() => {
    if (!user) return;
    const query = transferUsername.trim();
    if (query.length < 2) {
      setUsernameSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const d = await r.json();
        if (d.success) setUsernameSuggestions(d.data?.users ?? []);
      } catch {}
    }, 220);

    return () => clearTimeout(timer);
  }, [transferUsername, user]);

  const handleTransfer = async () => {
    const amt = parseInt(transferAmount, 10);
    if (!transferUsername.trim() || !amt || amt < 1 || transferring) return;
    if ((wallet?.balance ?? 0) < amt) {
      showToast("Insufficient SC balance", "error");
      return;
    }

    setTransferring(true);
    try {
      const r = await fetch("/api/credits/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ toUsername: transferUsername.trim(), amount: amt }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`💸 ${amt} SC sent to @${transferUsername}!`);
        setTransferUsername("");
        setTransferAmount("");
        setShowTransferModal(false);
        fetchData();
      } else {
        showToast(d.error ?? "Transfer failed", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    }
    setTransferring(false);
  };

  const transferTx = transactions.filter((tx) => tx.activity === "transfer" || tx.type === "transfer_out" || tx.type === "transfer_in");

  if (!user) {
    return (
      <div className={styles.authWall}>
        <div className={styles.authIcon}>🔒</div>
        <h1 className={styles.authTitle}>Sign in to use SC P2P</h1>
        <p className={styles.authSub}>Transfer SupaCredit instantly to any Pioneer.</p>
        <button className={styles.authBtn} onClick={() => router.push("/dashboard")}>
          Sign In with Pi
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {toast && <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>{toast.msg}</div>}

      <header className={styles.topBar}>
        <button className={styles.iconBtn} onClick={() => router.back()} aria-label="Back">
          ←
        </button>
        <h1 className={styles.topTitle}>SC P2P Transfer</h1>
        <Link href="/rewards" className={styles.iconBtn} aria-label="Rewards">
          💎
        </Link>
      </header>

      <div className={styles.content}>
        <div className={styles.balanceCard}>
          <div className={styles.balanceLabel}>Available Balance</div>
          <div className={styles.balanceValue}>{loading ? "..." : `${(wallet?.balance ?? 0).toLocaleString()} SC`}</div>
          <div className={styles.balanceHint}>0% fee · instant in Supapi ecosystem</div>
        </div>

        <div className={styles.transferCard}>
          <div className={styles.transferTitle}>Send SC to Any Pioneer</div>
          <div className={styles.transferSub}>Use username and amount to transfer SupaCredit.</div>
          <button className={styles.openTransferBtn} onClick={() => setShowTransferModal(true)}>
            Open Transfer Modal
          </button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Recent P2P Activity</div>
          {transferTx.length === 0 ? (
            <div className={styles.emptyCard}>No transfer activity yet.</div>
          ) : (
            <div className={styles.txList}>
              {transferTx.slice(0, 12).map((tx) => {
                const isIn = tx.type === "transfer_in";
                return (
                  <div key={tx.id} className={styles.txRow}>
                    <div className={styles.txLeft}>
                      <div className={styles.txLabel}>{tx.note || "SC Transfer"}</div>
                      <div className={styles.txTime}>{timeAgo(tx.created_at)}</div>
                    </div>
                    <div className={`${styles.txAmount} ${isIn ? styles.txIn : styles.txOut}`}>
                      {isIn ? "+" : "-"}
                      {Math.abs(tx.amount)} SC
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showTransferModal && (
        <div className={styles.transferModal}>
          <div className={styles.transferModalBackdrop} onClick={() => !transferring && setShowTransferModal(false)} />
          <div className={styles.transferModalSheet}>
            <div className={styles.transferModalHandle} />
            <div className={styles.transferModalEmoji}>💸</div>
            <div className={styles.transferModalTitle}>Send SupaCredit</div>
            <div className={styles.transferModalSub}>P2P transfer with zero fee</div>

            <input
              className={styles.transferInput}
              placeholder="Enter @username"
              list="sc-p2p-user-suggestions"
              value={transferUsername}
              onChange={(e) => setTransferUsername(e.target.value.replace("@", ""))}
            />
            <input
              className={styles.transferInput}
              placeholder="Amount (SC)"
              type="number"
              min="1"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
            />

            <div className={styles.transferModalInfo}>
              <div className={styles.transferModalRow}>
                <span className={styles.transferModalLabel}>Your Balance</span>
                <span className={styles.transferModalVal}>💎 {(wallet?.balance ?? 0).toLocaleString()} SC</span>
              </div>
              <div className={styles.transferModalRow}>
                <span className={styles.transferModalLabel}>Fee</span>
                <span className={styles.transferModalVal}>0 SC</span>
              </div>
              <div className={styles.transferModalRow}>
                <span className={styles.transferModalLabel}>Receiver Gets</span>
                <span className={styles.transferModalValGold}>
                  {transferAmount && Number(transferAmount) > 0 ? Number(transferAmount) : 0} SC
                </span>
              </div>
            </div>

            <button
              className={styles.transferModalConfirmBtn}
              onClick={handleTransfer}
              disabled={transferring || !transferUsername.trim() || !transferAmount}
            >
              {transferring ? "Sending..." : "Send Transfer"}
            </button>
            <button className={styles.transferModalCancelBtn} onClick={() => setShowTransferModal(false)} disabled={transferring}>
              Cancel
            </button>
            <datalist id="sc-p2p-user-suggestions">
              {usernameSuggestions.map((u) => (
                <option key={u.id} value={u.username} label={u.display_name ? `${u.display_name} (@${u.username})` : `@${u.username}`} />
              ))}
            </datalist>
          </div>
        </div>
      )}
    </div>
  );
}

