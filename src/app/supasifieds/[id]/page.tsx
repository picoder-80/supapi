"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import KycBadge from "@/components/ui/KycBadge";
import { formatListingCategoryPath } from "@/lib/supasifieds/categories";
import { CLASSIFIED_BOOST_TIERS } from "@/lib/supasifieds/boost-tiers";
import { formatPiPriceDisplay } from "@/lib/supasifieds/price";
import styles from "../../supamarket/[id]/page.module.css";

interface Classified {
  id: string;
  title: string;
  description: string;
  price_display: string | null;
  category: string;
  subcategory: string;
  category_deep?: string | null;
  images: string[];
  status: string;
  location: string;
  views: number;
  created_at: string;
  country_code: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  is_boosted?: boolean;
  boost_tier?: string;
  boost_expires_at?: string | null;
  seller: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    kyc_status: string;
  };
}

function getInitial(u: string) {
  return u?.charAt(0).toUpperCase() ?? "?";
}

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\s+/g, "").trim();
}

export default function SupasifiedsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [row, setRow] = useState<Classified | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIndex, setImgIndex] = useState(0);
  const [error, setError] = useState("");
  const [showBoost, setShowBoost] = useState(false);
  const [boostTier, setBoostTier] = useState("");
  const [boosting, setBoosting] = useState(false);
  const [scBalance, setScBalance] = useState<number | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";
        const r = await fetch(`/api/supasifieds/listings/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const d = await r.json();
        if (d.success) setRow(d.data);
      } catch {
        /* ignore */
      }
      setLoading(false);
    };
    fetch_();
  }, [id]);

  useEffect(() => {
    const fetchSc = async () => {
      const token = localStorage.getItem("supapi_token");
      if (!token) return;
      try {
        const r = await fetch("/api/wallet?tab=sc", { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.success && d.data?.scWallet?.balance != null) setScBalance(d.data.scWallet.balance);
      } catch {
        /* ignore */
      }
    };
    if (user) fetchSc();
  }, [user]);

  const handleBoost = async () => {
    if (!boostTier || !CLASSIFIED_BOOST_TIERS[boostTier]) return;
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setBoosting(true);
    try {
      const r = await fetch("/api/supasifieds/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ classified_id: id, tier: boostTier }),
      });
      const d = await r.json();
      if (d.success) {
        setShowBoost(false);
        setBoostTier("");
        const token2 = localStorage.getItem("supapi_token") ?? "";
        const r2 = await fetch(`/api/supasifieds/listings/${id}`, {
          headers: token2 ? { Authorization: `Bearer ${token2}` } : {},
        });
        const d2 = await r2.json();
        if (d2.success) setRow(d2.data);
      } else setError(d.error ?? "Boost failed");
    } catch {
      setError("Something went wrong");
    }
    setBoosting(false);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <button type="button" className={styles.iconBtn} onClick={() => router.back()}>
            ←
          </button>
          <div className={styles.topBarTitle}>Supasifieds</div>
          <span className={styles.iconBtn} />
        </div>
        <div className={styles.layout}>
          <div className={styles.skeletonCard} style={{ minHeight: 240 }} />
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <button type="button" className={styles.iconBtn} onClick={() => router.back()}>
            ←
          </button>
          <div className={styles.topBarTitle}>Supasifieds</div>
          <span className={styles.iconBtn} />
        </div>
        <div className={styles.notFoundCard}>
          <div className={styles.notFoundIcon}>🔍</div>
          <div className={styles.notFoundTitle}>Ad not found</div>
          <p className={styles.notFoundText}>It may have been removed or is no longer active.</p>
          <button type="button" className={styles.notFoundBtn} onClick={() => router.push("/supasifieds")}>
            Go to Supasifieds
          </button>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === row.seller.id;
  const images = row.images?.length ? row.images : [];
  const phone = row.contact_phone?.trim();
  const wa = row.contact_whatsapp?.trim();
  const waDigits = wa ? digitsOnly(wa) : "";
  const phoneCompact = normalizePhone(phone);
  const telHref = phoneCompact ? `tel:${phoneCompact}` : null;
  const waText = encodeURIComponent(`Hi, I'm interested in your listing: ${row.title}`);
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${waText}` : null;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button type="button" className={styles.iconBtn} onClick={() => router.back()}>
          ←
        </button>
        <div className={styles.topBarTitle}>Supasifieds</div>
        <span className={styles.iconBtn} />
      </div>

      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <div className={styles.galleryCard}>
            {images.length > 0 ? (
              <>
                <div className={styles.mainImg}>
                  <img src={images[imgIndex]} alt={row.title} className={styles.mainImgEl} />
                </div>
                {images.length > 1 && (
                  <div className={styles.thumbRow}>
                    {images.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`${styles.thumb} ${i === imgIndex ? styles.thumbActive : ""}`}
                        onClick={() => setImgIndex(i)}
                      >
                        <img src={img} alt="" className={styles.thumbImg} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.noImg}>📋</div>
            )}
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.infoCard}>
            <div className={styles.titleRow}>
              <h1 className={styles.listingTitle}>{row.title}</h1>
              <div className={styles.listingPrice}>{formatPiPriceDisplay(row.price_display)}</div>
            </div>
            <div className={styles.tags}>
              {row.location && <span className={styles.tag}>📍 {row.location}</span>}
              <span className={styles.tag}>
                {formatListingCategoryPath(row.category, row.subcategory ?? "", row.category_deep)}
              </span>
            </div>
            <div className={styles.escrowBanner}>No Pi escrow — deal directly with the seller</div>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.sectionTitle}>Seller</div>
            <Link href={`/supaspace/${row.seller.username}`} className={styles.sellerCard}>
              <div className={styles.sellerAvatar}>
                {row.seller.avatar_url ? (
                  <img src={row.seller.avatar_url} alt="" className={styles.sellerAvatarImg} />
                ) : (
                  <span className={styles.sellerAvatarInitial}>{getInitial(row.seller.username)}</span>
                )}
              </div>
              <div className={styles.sellerInfo}>
                <div className={styles.sellerName}>
                  {row.seller.display_name ?? row.seller.username}
                  {row.seller.kyc_status === "verified" && (
                    <span className={styles.kycBadge}>
                      <KycBadge size={14} />
                    </span>
                  )}
                </div>
                <div className={styles.sellerSub}>@{row.seller.username}</div>
              </div>
              <span className={styles.viewShopBtn}>Profile</span>
            </Link>
          </div>

          {row.description && (
            <div className={styles.infoCard}>
              <div className={styles.sectionTitle}>Description</div>
              <details className={styles.descriptionWrap}>
                <summary className={styles.readMore}>Read more</summary>
                <div className={styles.description}>{row.description}</div>
              </details>
            </div>
          )}

          <div className={styles.infoCard}>
            <div className={styles.statsRow}>
              <span className={styles.stat}>👁 {row.views} views</span>
            </div>
          </div>
        </div>
      </div>

      {!isOwner && row.status === "active" && (telHref || waHref) && (
        <div className={styles.stickyBar}>
          <div className={styles.contactActions}>
            {telHref && (
              <a href={telHref} className={`${styles.buyBtn} ${styles.contactBtnCall}`}>
                <span>📞 Call</span>
              </a>
            )}
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.buyBtn} ${styles.contactBtnWa}`}
              >
                <span>💬 WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      )}

      <div className={styles.bottomBar}>
        <button type="button" className={styles.backBtn} onClick={() => router.back()}>
          ← Back
        </button>
        {isOwner && (
          <div className={styles.bottomActions}>
            {row.status === "active" && (
              <button type="button" className={styles.ownerBoostBtn} onClick={() => setShowBoost(true)}>
                🚀 Boost (SC)
              </button>
            )}
            <Link href={`/supasifieds/${id}/edit`} className={styles.manageBtn}>
              Edit
            </Link>
            <Link href="/supasifieds/my-listings" className={styles.manageBtn}>
              My ads →
            </Link>
          </div>
        )}
      </div>

      {showBoost && isOwner && row.status === "active" && (
        <div className={styles.boostOverlay} onClick={() => !boosting && setShowBoost(false)}>
          <div className={styles.boostSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.boostHeader}>
              <div className={styles.boostTitle}>🚀 Boost ad</div>
              <button type="button" className={styles.boostClose} onClick={() => !boosting && setShowBoost(false)}>
                ✕
              </button>
            </div>
            <div className={styles.boostBody}>
              <div className={styles.boostSummary}>
                <div className={styles.boostSummaryImage}>
                  {images[0] ? <img src={images[0]} alt="" className={styles.boostSummaryImageEl} /> : <span>📋</span>}
                </div>
                <div className={styles.boostSummaryInfo}>
                  <div className={styles.boostItem}>{row.title}</div>
                  <div className={styles.boostSummaryPrice}>{formatPiPriceDisplay(row.price_display)}</div>
                </div>
              </div>
              {scBalance != null && (
                <div className={styles.boostBalance}>
                  SC balance: <strong>{scBalance}</strong>
                </div>
              )}
              <div className={styles.boostStepTitle}>Choose a tier</div>
              <div className={styles.boostTiers}>
                {(Object.entries(CLASSIFIED_BOOST_TIERS) as [string, { sc: number; hrs: number; label: string }][]).map(
                  ([tier, info]) => (
                    <button
                      key={tier}
                      type="button"
                      className={`${styles.boostTier} ${boostTier === tier ? styles.boostTierActive : ""}`}
                      onClick={() => setBoostTier(tier)}
                      disabled={scBalance != null && scBalance < info.sc}
                    >
                      <span className={styles.boostTierLabel}>{info.label}</span>
                      <span className={styles.boostTierSc}>{info.sc} SC</span>
                    </button>
                  )
                )}
              </div>
              {error && <div className={styles.errorMsg}>{error}</div>}
              <button type="button" className={styles.boostBtn} disabled={!boostTier || boosting} onClick={handleBoost}>
                {boosting ? "..." : `Boost ${boostTier ? CLASSIFIED_BOOST_TIERS[boostTier].sc : 0} SC`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
