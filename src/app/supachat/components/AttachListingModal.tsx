"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/supascrow/page.module.css";

type Listing = {
  id: string;
  title: string;
  price_pi?: number;
  images?: string[] | null;
  category?: string;
  status?: string;
};

type AttachListingModalProps = {
  onClose: () => void;
  onSelect: (listing: Listing) => void;
  token: string;
};

export default function AttachListingModal({
  onClose,
  onSelect,
  token,
}: AttachListingModalProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/supamarket/listings/mine?status=active", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.data)) {
          setListings(d.data.filter((l: any) => (l.status === "active" || !l.status) && (l.stock ?? 1) > 0));
        }
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.createModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.createModalHeader}>
          <div className={styles.createModalIcon}>📎</div>
          <div className={styles.createModalBadge}>Attach Listing</div>
          <h2 className={styles.createModalTitle}>Share a listing</h2>
          <p className={styles.createModalSub}>Choose a listing to share in this chat</p>
        </div>
        <div className={styles.createModalBody}>
          {loading ? (
            <div className={styles.msg}>Loading your listings...</div>
          ) : listings.length === 0 ? (
            <div className={styles.msg}>
              <p style={{ marginBottom: 12 }}>You have no active listings to share.</p>
              <Link href="/supamarket/create" className={styles.btnPrimary} style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }}>
                Create listing
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {listings.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onSelect(l)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg)",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  {l.images?.[0] ? (
                    <img src={l.images[0]} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 8, background: "#E2E8F0", display: "grid", placeItems: "center", fontSize: 20 }}>🛍️</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</div>
                    {l.price_pi != null && (
                      <div style={{ fontSize: 12, color: "#718096" }}>π{Number(l.price_pi).toFixed(2)}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.createModalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <Link href="/supamarket" className={styles.btnPrimary} style={{ textDecoration: "none", textAlign: "center" }}>
            Browse SupaMarket
          </Link>
        </div>
      </div>
    </div>
  );
}
