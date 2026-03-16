"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { CountrySelect } from "@/components/CountrySelect";
import styles from "./page.module.css";

const CATEGORIES = [
  { id: "all",           emoji: "📦", label: "All"            },
  { id: "electronics",   emoji: "📱", label: "Electronics"    },
  { id: "fashion",       emoji: "👗", label: "Fashion"        },
  { id: "food",          emoji: "🍜", label: "Food & Bev"     },
  { id: "health",        emoji: "💊", label: "Health"         },
  { id: "home",          emoji: "🏠", label: "Home & Garden"  },
  { id: "machinery",     emoji: "⚙️", label: "Machinery"      },
  { id: "raw-materials", emoji: "🪨", label: "Raw Materials"  },
  { id: "packaging",     emoji: "📫", label: "Packaging"      },
  { id: "auto",          emoji: "🚗", label: "Auto Parts"     },
  { id: "sports",        emoji: "⚽", label: "Sports"         },
  { id: "toys",          emoji: "🧸", label: "Toys"           },
  { id: "office",        emoji: "🖊️", label: "Office"         },
  { id: "agriculture",   emoji: "🌾", label: "Agriculture"    },
  { id: "textiles",      emoji: "🧵", label: "Textiles"       },
  { id: "others",        emoji: "🔧", label: "Others"         },
];

const TIER_BADGES: Record<string, string> = {
  gold: "🥇 Gold",
  verified: "🥈 Verified",
  basic: "🥉 Basic",
};

interface Supplier {
  id: string; user_id: string; company_name: string; country: string;
  logo_url: string; verified_tier: string; total_orders: number;
  total_products: number; categories: string[]; response_rate: number;
  user?: { username: string; avatar_url: string | null; kyc_status: string };
}

interface Product {
  id: string; supplier_id: string; title: string; images: string[];
  category: string; moq: number; price_tiers: any[];
  lead_time: string; ship_from: string; view_count: number;
  order_count: number; sample_available: boolean;
  supplier?: { company_name: string; country: string; verified_tier: string };
}

interface RFQ {
  id: string; buyer_id: string; title: string; category: string;
  quantity: number; unit: string; target_price_pi: number | null;
  deadline: string | null; quote_count: number; created_at: string;
  buyer?: { username: string; avatar_url: string | null; kyc_status: string };
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function getInitial(s: string) { return (s ?? "?").charAt(0).toUpperCase(); }

function getMinPrice(tiers: any[]): number {
  if (!tiers?.length) return 0;
  return Math.min(...tiers.map((t: any) => parseFloat(t.price_pi ?? 0)));
}

export default function BulkHubPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "rfq" | "suppliers">("products");
  const [searchQ, setSearchQ]   = useState("");
  const [country, setCountry]  = useState("MY");
  const [catFilter, setCatFilter] = useState("all");
  const [showRegModal, setShowRegModal] = useState(false);
  const [regForm, setRegForm]   = useState({ company_name: "", country: "", description: "", categories: [] as string[], established_year: new Date().getFullYear() });
  const [regLoading, setRegLoading] = useState(false);
  const [toast, setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [mySupplier, setMySupplier] = useState<any>(null);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetch("/api/geo").then((r) => r.json()).then((d) => {
      if (d.success) setCountry(d.data.code);
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ country });
      const r = await fetch(`/api/supabulk?${params}`);
      const d = await r.json();
      if (d.success) setData(d.data);
    } catch {}
    setLoading(false);
  }, [country]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Check if user is already a supplier
  useEffect(() => {
    if (!user) return;
    const checkSupplier = async () => {
      const r = await fetch("/api/supabulk/products", { headers: { Authorization: `Bearer ${token()}` } });
    };
  }, [user]);

  const handleRegisterSupplier = async () => {
    if (!user) { router.push("/dashboard"); return; }
    if (!regForm.company_name.trim()) { showToast("Company name required", "error"); return; }
    setRegLoading(true);
    try {
      const r = await fetch("/api/supabulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "register_supplier", ...regForm }),
      });
      const d = await r.json();
      if (d.success) {
        setMySupplier(d.data);
        setShowRegModal(false);
        showToast("🎉 Welcome to SupaBulk! +100 SC earned!");
        fetchData();
      } else {
        showToast(d.error ?? "Registration failed", "error");
      }
    } catch { showToast("Something went wrong", "error"); }
    setRegLoading(false);
  };

  const filteredProducts = (data?.trendingProducts ?? []).filter((p: Product) =>
    (catFilter === "all" || p.category === catFilter) &&
    (!searchQ || p.title.toLowerCase().includes(searchQ.toLowerCase()))
  );

  const filteredRfqs = (data?.openRfqs ?? []).filter((r: RFQ) =>
    catFilter === "all" || r.category === catFilter
  );

  return (
    <div className={styles.page}>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Hero Header ── */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>🌐 Pi B2B Wholesale</div>
          <h1 className={styles.heroTitle}>📦 SupaBulk</h1>
          <p className={styles.heroSub}>Connect with global Pi Network suppliers. Source in bulk, pay with Pi.</p>

          {/* Country selector */}
          <div className={styles.countryRow}>
            <CountrySelect value={country} onChange={setCountry} />
          </div>

          {/* Search */}
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              placeholder="Search products, suppliers..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <button className={styles.searchBtn}>🔍</button>
          </div>

          {/* Stats */}
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{data?.stats?.suppliers ?? "—"}</span>
              <span className={styles.heroStatLabel}>Suppliers</span>
            </div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{data?.stats?.products ?? "—"}</span>
              <span className={styles.heroStatLabel}>Products</span>
            </div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>π</span>
              <span className={styles.heroStatLabel}>Pay with Pi</span>
            </div>
          </div>
        </div>

        {/* Supplier CTA */}
        <div className={styles.supplierCta}>
          <span className={styles.supplierCtaText}>Are you a supplier or manufacturer?</span>
          <button className={styles.supplierCtaBtn} onClick={() => user ? setShowRegModal(true) : router.push("/dashboard")}>
            Register as Supplier →
          </button>
        </div>
      </div>

      {/* ── Category Pills ── */}
      <div className={styles.catWrap}>
        <div className={styles.catScroll}>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              className={`${styles.catPill} ${catFilter === c.id ? styles.catPillActive : ""}`}
              onClick={() => setCatFilter(c.id)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabsWrap}>
        <div className={styles.tabs}>
          {(["products", "rfq", "suppliers"] as const).map(t => (
            <button
              key={t}
              className={`${styles.tab} ${activeTab === t ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(t)}
            >
              {t === "products" ? "📦 Products" : t === "rfq" ? "📋 RFQ Board" : "🏭 Suppliers"}
            </button>
          ))}
        </div>
        {activeTab === "rfq" && (
          <button className={styles.postRfqBtn} onClick={() => user ? router.push("/bulkhub/rfq/create") : router.push("/dashboard")}>
            + Post RFQ
          </button>
        )}
      </div>

      <div className={styles.body}>

        {/* ── Products Tab ── */}
        {activeTab === "products" && (
          loading ? (
            <div className={styles.grid}>
              {[...Array(8)].map((_, i) => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📦</div>
              <div className={styles.emptyTitle}>No products found</div>
              <div className={styles.emptyDesc}>Be the first supplier to list products in this category!</div>
              <button className={styles.emptyBtn} onClick={() => setShowRegModal(true)}>Become a Supplier</button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredProducts.map((product: Product) => {
                const minPrice = getMinPrice(product.price_tiers);
                return (
                  <Link key={product.id} href={`/bulkhub/product/${product.id}`} className={styles.productCard}>
                    <div className={styles.productImg}>
                      {product.images?.[0]
                        ? <img src={product.images[0]} alt={product.title} className={styles.productImgEl} />
                        : <div className={styles.productImgPlaceholder}>{CATEGORIES.find(c => c.id === product.category)?.emoji ?? "📦"}</div>
                      }
                      {product.sample_available && <span className={styles.sampleBadge}>Sample</span>}
                    </div>
                    <div className={styles.productBody}>
                      <div className={styles.productTitle}>{product.title}</div>
                      <div className={styles.productPrice}>
                        from <span className={styles.productPriceNum}>π {minPrice.toFixed(2)}</span>/unit
                      </div>
                      <div className={styles.productMoq}>MOQ: {product.moq.toLocaleString()} units</div>
                      {product.supplier && (
                        <div className={styles.productSupplier}>
                          <span className={styles.supplierTierDot}>{TIER_BADGES[product.supplier.verified_tier]}</span>
                          <span className={styles.supplierName}>{product.supplier.company_name}</span>
                        </div>
                      )}
                      <div className={styles.productMeta}>
                        <span>⏱ {product.lead_time}</span>
                        {product.ship_from && <span>📍 {product.ship_from}</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* ── RFQ Tab ── */}
        {activeTab === "rfq" && (
          <div className={styles.rfqList}>
            {loading ? (
              [...Array(4)].map((_, i) => <div key={i} className={styles.skeletonRfq} />)
            ) : filteredRfqs.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📋</div>
                <div className={styles.emptyTitle}>No open RFQs</div>
                <div className={styles.emptyDesc}>Post your sourcing requirement and let suppliers come to you!</div>
                <Link href="/bulkhub/rfq/create" className={styles.emptyBtn}>Post RFQ</Link>
              </div>
            ) : (
              filteredRfqs.map((rfq: RFQ) => (
                <div key={rfq.id} className={styles.rfqCard}>
                  <div className={styles.rfqTop}>
                    <div className={styles.rfqCatBadge}>
                      {CATEGORIES.find(c => c.id === rfq.category)?.emoji} {rfq.category}
                    </div>
                    <span className={styles.rfqTime}>{timeAgo(rfq.created_at)}</span>
                  </div>
                  <div className={styles.rfqTitle}>{rfq.title}</div>
                  <div className={styles.rfqMeta}>
                    <span>📦 {rfq.quantity.toLocaleString()} {rfq.unit}</span>
                    {rfq.target_price_pi && <span>💰 Target: π {rfq.target_price_pi}/unit</span>}
                    {rfq.deadline && <span>⏰ Due: {new Date(rfq.deadline).toLocaleDateString()}</span>}
                  </div>
                  <div className={styles.rfqFooter}>
                    {rfq.buyer && (
                      <div className={styles.rfqBuyer}>
                        <div className={styles.rfqBuyerAvatar}>
                          {rfq.buyer.avatar_url
                            ? <img src={rfq.buyer.avatar_url} alt="" className={styles.rfqBuyerAvatarImg} />
                            : <span>{getInitial(rfq.buyer.username)}</span>
                          }
                        </div>
                        <span className={styles.rfqBuyerName}>
                          @{rfq.buyer.username}
                          {rfq.buyer.kyc_status === "verified" && " ✅"}
                        </span>
                      </div>
                    )}
                    <div className={styles.rfqActions}>
                      <span className={styles.rfqQuoteCount}>💬 {rfq.quote_count} quotes</span>
                      <button
                        className={styles.rfqQuoteBtn}
                        onClick={() => user ? router.push(`/bulkhub/rfq/${rfq.id}`) : router.push("/dashboard")}
                      >
                        Submit Quote →
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Suppliers Tab ── */}
        {activeTab === "suppliers" && (
          loading ? (
            <div className={styles.supplierGrid}>
              {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonSupplier} />)}
            </div>
          ) : (data?.featuredSuppliers ?? []).length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🏭</div>
              <div className={styles.emptyTitle}>No suppliers yet</div>
              <div className={styles.emptyDesc}>Be the first Pi Network supplier on SupaBulk!</div>
              <button className={styles.emptyBtn} onClick={() => setShowRegModal(true)}>Register Now</button>
            </div>
          ) : (
            <div className={styles.supplierGrid}>
              {(data?.featuredSuppliers ?? []).map((supplier: Supplier) => (
                <Link key={supplier.id} href={`/bulkhub/supplier/${supplier.id}`} className={styles.supplierCard}>
                  <div className={styles.supplierCardTop}>
                    <div className={styles.supplierLogo}>
                      {supplier.logo_url
                        ? <img src={supplier.logo_url} alt={supplier.company_name} className={styles.supplierLogoImg} />
                        : <span className={styles.supplierLogoInitial}>{getInitial(supplier.company_name)}</span>
                      }
                    </div>
                    <div className={styles.supplierCardInfo}>
                      <div className={styles.supplierCardName}>{supplier.company_name}</div>
                      <div className={styles.supplierCardCountry}>📍 {supplier.country}</div>
                      <div className={styles.supplierTierBadge}>{TIER_BADGES[supplier.verified_tier]}</div>
                    </div>
                  </div>
                  <div className={styles.supplierCardCats}>
                    {supplier.categories?.slice(0, 3).map(cat => (
                      <span key={cat} className={styles.supplierCatTag}>{cat}</span>
                    ))}
                  </div>
                  <div className={styles.supplierCardStats}>
                    <span>📦 {supplier.total_products} products</span>
                    <span>✅ {supplier.response_rate}% response</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Register Supplier Modal ── */}
      {showRegModal && (
        <div className={styles.modal}>
          <div className={styles.modalBackdrop} onClick={() => !regLoading && setShowRegModal(false)} />
          <div className={styles.modalSheet}>
            <div className={styles.modalHandle} />
            <div className={styles.modalTitle}>🏭 Register as Supplier</div>
            <div className={styles.modalSub}>Join SupaBulk and reach Pi Network buyers worldwide. +100 SC bonus!</div>

            <div className={styles.formLabel}>Company Name *</div>
            <input className={styles.formInput} placeholder="e.g. Sunrise Electronics Co." value={regForm.company_name}
              onChange={e => setRegForm(f => ({ ...f, company_name: e.target.value }))} />

            <div className={styles.formLabel}>Country *</div>
            <input className={styles.formInput} placeholder="e.g. United States" value={regForm.country}
              onChange={e => setRegForm(f => ({ ...f, country: e.target.value }))} />

            <div className={styles.formLabel}>Company Description</div>
            <textarea className={styles.formTextarea} rows={3}
              placeholder="What do you manufacture or supply?"
              value={regForm.description}
              onChange={e => setRegForm(f => ({ ...f, description: e.target.value }))} />

            <div className={styles.formLabel}>Year Established</div>
            <input className={styles.formInput} type="number" placeholder="2020"
              value={regForm.established_year}
              onChange={e => setRegForm(f => ({ ...f, established_year: parseInt(e.target.value) }))} />

            <button className={styles.modalSubmitBtn} onClick={handleRegisterSupplier} disabled={regLoading}>
              {regLoading ? "Registering..." : "🚀 Register & Earn 100 SC"}
            </button>
            <button className={styles.modalCancelBtn} onClick={() => setShowRegModal(false)} disabled={regLoading}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
