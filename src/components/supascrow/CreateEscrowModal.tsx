"use client";

import { useEffect, useState } from "react";
import styles from "@/app/supascrow/page.module.css";

type UserSuggestion = { id: string; username: string; display_name: string | null };

type CreateEscrowModalProps = {
  onClose: () => void;
  onSuccess?: (dealId: string) => void;
  defaultSeller?: string;
  token: string;
};

export default function CreateEscrowModal({
  onClose,
  onSuccess,
  defaultSeller = "",
  token,
}: CreateEscrowModalProps) {
  const [createSeller, setCreateSeller] = useState(defaultSeller);
  const [createTitle, setCreateTitle] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createCurrency, setCreateCurrency] = useState<"pi" | "sc">("sc");
  const [sellerSuggestions, setSellerSuggestions] = useState<UserSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [commissionPct, setCommissionPct] = useState<number | null>(null);

  useEffect(() => {
    setCreateSeller(defaultSeller);
  }, [defaultSeller]);

  useEffect(() => {
    fetch("/api/config/commission")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && typeof d.data?.commission_supascrow === "number") {
          setCommissionPct(d.data.commission_supascrow);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const query = createSeller.trim().replace(/^@/, "");
    if (query.length < 2) {
      setSellerSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (d?.success) setSellerSuggestions(d.data?.users ?? []);
      } catch {
        setSellerSuggestions([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [createSeller, token]);

  const resolveSeller = async (username: string): Promise<string | null> => {
    const r = await fetch(`/api/supascrow?lookup=${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    return d?.data?.id ?? null;
  };

  const handleSubmit = async () => {
    const sellerUsername = createSeller.trim().replace(/^@/, "");
    if (!sellerUsername || !createTitle.trim() || !createAmount.trim()) {
      setMsg("Fill seller username, title, and amount");
      return;
    }
    const amount = parseFloat(createAmount);
    if (isNaN(amount) || amount <= 0) {
      setMsg("Invalid amount");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const sellerId = await resolveSeller(sellerUsername);
      if (!sellerId) {
        setMsg("Seller username not found");
        setBusy(false);
        return;
      }
      const r = await fetch("/api/supascrow", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "create",
          seller_id: sellerId,
          title: createTitle.trim(),
          amount_pi: amount,
          description: createDesc.trim() || undefined,
          currency: createCurrency,
        }),
      });
      const d = await r.json();
      if (d?.success && d?.data?.deal?.id) {
        onClose();
        onSuccess?.(d.data.deal.id);
      } else {
        setMsg(d?.error ?? "Failed to create deal");
      }
    } catch {
      setMsg("Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={() => !busy && onClose()}>
      <div className={`${styles.modal} ${styles.createModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.createModalHeader}>
          <div className={styles.createModalIcon}>🛡️</div>
          <div className={styles.createModalBadge}>Secure Escrow</div>
          <h2 className={styles.createModalTitle}>Create Escrow Deal</h2>
          <p className={styles.createModalSub}>Funds held safely until delivery is confirmed</p>
        </div>
        <div className={styles.createModalBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Seller</label>
            <input
              className={styles.input}
              placeholder="Username (e.g. johndoe)"
              list="create-escrow-seller-suggestions"
              value={createSeller}
              onChange={(e) => setCreateSeller(e.target.value.replace("@", ""))}
            />
            <datalist id="create-escrow-seller-suggestions">
              {sellerSuggestions.map((u) => (
                <option key={u.id} value={u.username} label={u.display_name ? `${u.display_name} (@${u.username})` : `@${u.username}`} />
              ))}
            </datalist>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Deal Title</label>
            <input
              className={styles.input}
              placeholder="What are you trading?"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Amount</label>
            <div className={styles.amountRow}>
              <input
                className={styles.amountInput}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
              />
              <select
                className={styles.currencySelect}
                value={createCurrency}
                onChange={(e) => setCreateCurrency(e.target.value as "pi" | "sc")}
              >
                <option value="sc">💎 SC</option>
                <option value="pi">π Pi</option>
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description <span className={styles.formLabelOpt}>(optional)</span></label>
            <textarea
              className={styles.textarea}
              placeholder="Add terms or notes for the deal..."
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              rows={3}
            />
          </div>
          {commissionPct != null && (
            <p className={styles.feeNote}>* Note: Admin fees ({commissionPct}%) are deducted from seller payout on Pi release.</p>
          )}
          {msg && <div className={styles.msg} style={{ marginTop: 8 }}>{msg}</div>}
        </div>
        <div className={styles.createModalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={busy}>
            {busy ? "Creating..." : "Create Deal"}
          </button>
        </div>
      </div>
    </div>
  );
}
