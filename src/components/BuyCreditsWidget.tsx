"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ensurePaymentReady, createPiPayment, isPiBrowser } from "@/lib/pi/sdk";
import styles from "./BuyCreditsWidget.module.css";

const SC_PACKAGES = [
  { id: "starter", sc: 100, usd: 1.0, label: "Starter", popular: false },
  { id: "popular", sc: 500, usd: 5.0, label: "Popular", popular: true },
  { id: "pro", sc: 1000, usd: 10.0, label: "Pro", popular: false },
  { id: "whale", sc: 5000, usd: 50.0, label: "Whale", popular: false },
];

export interface BuyCreditsWidgetProps {
  /** Callback after successful purchase (e.g. refresh wallet / data) */
  onSuccess?: () => void;
  /** Optional: show message to user (e.g. "Sign in to buy", "Payment cancelled") */
  onMessage?: (msg: string) => void;
  /** Show section title. Default true */
  showTitle?: boolean;
  /** Layout: default (2x2 grid) or compact (smaller). Default "default" */
  variant?: "default" | "compact";
  /** Optional wrapper className */
  className?: string;
}

export default function BuyCreditsWidget({
  onSuccess,
  onMessage,
  showTitle = true,
  variant = "default",
  className,
}: BuyCreditsWidgetProps) {
  const { user } = useAuth();
  const [piRate, setPiRate] = useState(1.5);
  const [buyPkg, setBuyPkg] = useState<typeof SC_PACKAGES[0] | null>(null);
  const [buying, setBuying] = useState(false);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  useEffect(() => {
    fetch("/api/pi-price")
      .then((r) => r.json())
      .then((d) => { if (d?.price != null) setPiRate(Number(d.price)); })
      .catch(() => {});
  }, []);

  const handleBuy = async () => {
    if (!buyPkg || buying || !user) return;
    if (!isPiBrowser()) {
      onMessage?.("Please open in Pi Browser to buy with Pi.");
      return;
    }
    setBuying(true);
    const currentPkg = buyPkg;
    const piAmount = parseFloat((currentPkg.usd / piRate).toFixed(6));
    try {
      await ensurePaymentReady();
      createPiPayment(
        {
          amount: piAmount,
          memo: `Buy ${currentPkg.sc} Supapi Credits`,
          metadata: { pkg: currentPkg.id, sc: currentPkg.sc },
        },
        {
          onReadyForServerApproval: (paymentId: string) => {
            fetch("/api/credits/buy", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
              body: JSON.stringify({ paymentId, action: "approve" }),
            }).catch(console.error);
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            try {
              const r = await fetch("/api/credits/buy", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
                body: JSON.stringify({ paymentId, txid, action: "complete", pkg: currentPkg.id, sc: currentPkg.sc }),
              });
              const d = await r.json();
              if (d.success) {
                onMessage?.(`🎉 +${currentPkg.sc} SC added!`);
                onSuccess?.();
              } else {
                onMessage?.(`❌ ${d.error ?? "SC credit failed"}`);
              }
            } catch {
              onMessage?.("❌ Failed to credit SC");
            }
            setBuyPkg(null);
            setBuying(false);
          },
          onCancel: () => {
            onMessage?.("Payment cancelled.");
            setBuyPkg(null);
            setBuying(false);
          },
          onError: () => {
            onMessage?.("Payment error. Please try again.");
            setBuyPkg(null);
            setBuying(false);
          },
        }
      );
    } catch {
      onMessage?.("Payment error. Please try again.");
      setBuying(false);
    }
  };

  const handlePackageClick = (pkg: typeof SC_PACKAGES[0]) => {
    if (!user) {
      onMessage?.("Sign in to buy SC");
      return;
    }
    setBuyPkg(pkg);
  };

  return (
    <section className={`${styles.root} ${variant === "compact" ? styles.compact : ""} ${className ?? ""}`}>
      {showTitle && <div className={styles.sectionTitle}>💎 Buy Supapi Credits</div>}
      <div className={styles.piRateBadge}>
        <div className={styles.piRateDot} />
        <span>1 Pi ≈ ${piRate.toFixed(2)} USD · Live rate</span>
      </div>
      <div className={styles.packageGrid}>
        {SC_PACKAGES.map((pkg) => {
          const piNeeded = (pkg.usd / piRate).toFixed(3);
          return (
            <button
              key={pkg.id}
              type="button"
              className={`${styles.packageCard} ${pkg.popular ? styles.packageCardPopular : ""}`}
              onClick={() => handlePackageClick(pkg)}
            >
              {pkg.popular && <div className={styles.packagePopularBadge}>⭐ Popular</div>}
              <div className={styles.packageSc}>{pkg.sc.toLocaleString()}</div>
              <div className={styles.packageScLabel}>SC</div>
              <div className={styles.packagePi}>π {piNeeded} Pi</div>
              <span className={styles.packageBtn}>Buy Now</span>
            </button>
          );
        })}
      </div>
      <div className={styles.packageNote}>
        💡 Rate updates live · Pay with Pi in Pi Browser
      </div>

      {buyPkg && (
        <div className={styles.buyModal}>
          <div className={styles.buyModalBackdrop} onClick={() => !buying && setBuyPkg(null)} />
          <div className={styles.buyModalSheet}>
            <div className={styles.buyModalHandle} />
            <div className={styles.buyModalTitle}>💎 Buy {buyPkg.sc.toLocaleString()} SC</div>
            <div className={styles.buyModalSub}>Confirm your purchase with Pi</div>
            <div className={styles.buyModalInfo}>
              <div className={styles.buyModalRow}>
                <span className={styles.buyModalRowLabel}>Package</span>
                <span className={styles.buyModalRowVal}>{buyPkg.label} — {buyPkg.sc.toLocaleString()} SC</span>
              </div>
              <div className={styles.buyModalRow}>
                <span className={styles.buyModalRowLabel}>Pi Rate</span>
                <span className={styles.buyModalRowVal}>1 Pi ≈ ${piRate.toFixed(2)}</span>
              </div>
              <div className={styles.buyModalRow}>
                <span className={styles.buyModalRowLabel}>You Pay</span>
                <span className={styles.buyModalRowValGold}>π {(buyPkg.usd / piRate).toFixed(3)} Pi</span>
              </div>
              <div className={styles.buyModalRow}>
                <span className={styles.buyModalRowLabel}>You Get</span>
                <span className={styles.buyModalRowValGold}>💎 {buyPkg.sc.toLocaleString()} SC</span>
              </div>
            </div>
            <button
              className={styles.buyModalConfirmBtn}
              onClick={handleBuy}
              disabled={buying}
            >
              {buying ? "Processing..." : `Pay π ${(buyPkg.usd / piRate).toFixed(3)} Pi`}
            </button>
            <button className={styles.buyModalCancelBtn} onClick={() => setBuyPkg(null)} disabled={buying}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
