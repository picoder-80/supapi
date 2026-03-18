"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import CreateEscrowModal from "@/components/supascrow/CreateEscrowModal";
import { usePiPayment } from "@/hooks/usePiPayment";
import { ensurePaymentReady } from "@/lib/pi/sdk";
import styles from "./page.module.css";

type Deal = {
  id: string;
  title: string;
  amount_pi: number;
  currency: string;
  status: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  buyer?: { id: string; username: string; display_name: string | null; can_receive_pi?: boolean };
  seller?: { id: string; username: string; display_name: string | null; can_receive_pi?: boolean };
};

type DealDetail = Deal & {
  description?: string;
  terms?: string;
  tracking_number?: string;
  tracking_carrier?: string;
};

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: { id: string; username: string; display_name: string | null };
};

const INTRO_FLOW = [
  "Buyer & seller agree on terms via chat",
  "Buyer funds escrow (Pi or SC)",
  "Seller ships with tracking",
  "Buyer confirms delivery",
  "Funds released to seller instantly",
];

const STATUS_LABELS: Record<string, string> = {
  created: "Awaiting seller",
  accepted: "Awaiting payment",
  funded: "Awaiting shipment",
  shipped: "Awaiting delivery",
  delivered: "Ready to release",
  released: "Completed",
  disputed: "In dispute",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

function SupaScrowPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [roleFilter, setRoleFilter] = useState<"all" | "buyer" | "seller">("all");
  const [selectedDeal, setSelectedDeal] = useState<DealDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [scBalance, setScBalance] = useState<number | null>(null);
  const { pay: payWithPi, isPaying: piPaying } = usePiPayment();

  const fetchScBalance = useCallback(async () => {
    if (!user) return;
    try {
      const r = await fetch("/api/credits", { headers: { Authorization: `Bearer ${token()}` } });
      const d = await r.json();
      if (d?.success && d.data?.wallet) setScBalance(Number(d.data.wallet.balance ?? 0));
    } catch {
      setScBalance(null);
    }
  }, [user]);

  useEffect(() => {
    fetchScBalance();
  }, [fetchScBalance]);


  useEffect(() => {
    if (!selectedDeal) return;
    setTrackingNumber("");
    setTrackingCarrier("");
  }, [selectedDeal?.id]);

  const fetchDeals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/supascrow?role=${roleFilter}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d?.success) setDeals(d.data.deals ?? []);
    } catch {
      setMsg("Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, [user, roleFilter]);

  const fetchDealDetail = useCallback(
    async (dealId: string) => {
      if (!user) return;
      try {
        const r = await fetch(`/api/supascrow?deal_id=${dealId}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const d = await r.json();
        if (d?.success) {
          setSelectedDeal(d.data.deal);
          setMessages(d.data.messages ?? []);
        }
      } catch {
        setMsg("Failed to load deal");
      }
    },
    [user]
  );

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const dealIdFromUrl = searchParams.get("deal");
  useEffect(() => {
    if (!user || !dealIdFromUrl) return;
    fetchDealDetail(dealIdFromUrl);
  }, [user, dealIdFromUrl, fetchDealDetail]);

  const runAction = async (
    action: string,
    payload: Record<string, unknown> = {}
  ) => {
    if (!user || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/supascrow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const d = await r.json();
      if (d?.success) {
        const data = d.data || {};
        if (action === "dispute") {
          if (data.auto_resolved) {
            setMsg(`✅ Dispute resolved. ${data.message ?? "Outcome has been applied."}`);
          } else {
            setMsg(`✅ Dispute received. Our team will review and resolve it shortly.`);
          }
          setDisputeReason("");
        } else {
          setMsg(`✅ ${data.message ?? "Done"}`);
        }
        if (selectedDeal) await fetchDealDetail(selectedDeal.id);
        await fetchDeals();
        if (action === "fund" || action === "release") fetchScBalance();
      } else {
        setMsg(`❌ ${d?.error ?? "Failed"}`);
      }
    } catch {
      setMsg("❌ Request failed");
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    const body = chatInput.trim();
    if (!body || !selectedDeal || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/supascrow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ action: "send_message", deal_id: selectedDeal.id, body }),
      });
      const d = await r.json();
      if (d?.success) {
        setChatInput("");
        await fetchDealDetail(selectedDeal.id);
      } else {
        setMsg(`❌ ${d?.error ?? "Failed"}`);
      }
    } catch {
      setMsg("❌ Send failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDealCreated = async (dealId?: string) => {
    await fetchDeals();
    setMsg("✅ Deal created");
    if (dealId) fetchDealDetail(dealId);
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.introHero}>
          <div className={styles.heroBadge}>🔒 Secure Pi Escrow</div>
          <div className={styles.introIcon}>🛡️</div>
          <h1 className={styles.title}>SupaScrow</h1>
          <p className={styles.sub}>
            Trade safely with strangers. Funds held in escrow until you confirm delivery.
          </p>
          <div className={styles.introActions}>
            <button className={styles.btnPrimary} onClick={() => router.push("/dashboard")}>
              Sign in with Pi to Start
            </button>
            <Link href="/supamarket" className={styles.btnSecondary}>
              Browse SupaMarket
            </Link>
          </div>
        </div>

        <div className={styles.introSection}>
          <div className={styles.sectionTitle}>🔄 How It Works</div>
          <div className={styles.introLoop}>
            {INTRO_FLOW.map((step, idx) => (
              <div key={step} className={styles.introLoopRow}>
                <span className={styles.introStepNo}>{idx + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.introSection}>
          <div className={styles.introNote}>
            Need help? Use the in-app assistant for escrow tips and safe trading practices.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.icon}>🛡️</span>
          <div className={styles.headerText}>
            <div className={styles.heroBadge}>🔒 Secure Escrow</div>
            <h1 className={styles.title}>SupaScrow</h1>
            <p className={styles.sub}>Create deals, chat, fund, ship, and release safely.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {scBalance != null && (
            <span className={styles.walletChip}>💎 {scBalance.toLocaleString()} SC</span>
          )}
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            + New Deal
          </button>
        </div>
      </div>

      {!!msg && <div className={styles.msg}>{msg}</div>}

      <section className={styles.section}>
        <div className={styles.filterRow}>
          <span className={styles.sectionTitle}>My Deals</span>
          <div className={styles.tabs}>
            {(["all", "buyer", "seller"] as const).map((r) => (
              <button
                key={r}
                className={`${styles.tab} ${roleFilter === r ? styles.tabActive : ""}`}
                onClick={() => setRoleFilter(r)}
              >
                {r === "all" ? "All" : r === "buyer" ? "As Buyer" : "As Seller"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.skeletonGrid}>
            {[1, 2, 3].map((n) => (
              <div key={n} className={styles.skeletonCard} />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📋</div>
            <div className={styles.emptyTitle}>No deals yet</div>
            <div className={styles.emptyDesc}>Create a deal or wait for someone to invite you.</div>
            <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
              Create Deal
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {deals.map((deal) => (
              <div
                key={deal.id}
                className={styles.card}
                onClick={() => {
                  setSelectedDeal(deal as DealDetail);
                  fetchDealDetail(deal.id);
                }}
              >
                <div className={styles.cardHead}>
                  <div className={styles.cardTitle}>{deal.title}</div>
                  <span className={styles.statusBadge} data-status={deal.status}>
                    {STATUS_LABELS[deal.status] ?? deal.status}
                  </span>
                </div>
                <div className={styles.cardMeta}>
                  {deal.currency === "sc" ? "💎" : "π"} {Number(deal.amount_pi).toLocaleString()} {deal.currency.toUpperCase()}
                </div>
                <div className={styles.cardParties}>
                  <span>Buyer: @{(deal.buyer as { username?: string })?.username ?? "?"}</span>
                  <span>Seller: @{(deal.seller as { username?: string })?.username ?? "?"}</span>
                </div>
                <div className={styles.cardTime}>{timeAgo(deal.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <CreateEscrowModal
          onClose={() => setShowCreate(false)}
          onSuccess={handleDealCreated}
          token={token()}
        />
      )}

      {/* Deal detail modal */}
      {selectedDeal && (
        <div className={styles.modalOverlay} onClick={() => setSelectedDeal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>{selectedDeal.title}</div>
            <div className={styles.detailMeta}>
              {selectedDeal.currency === "sc" ? "💎" : "π"} {Number(selectedDeal.amount_pi).toLocaleString()} · {STATUS_LABELS[selectedDeal.status] ?? selectedDeal.status}
            </div>
            {selectedDeal.description && (
              <div className={styles.detailDesc}>{selectedDeal.description}</div>
            )}

            {/* Chat */}
            <div className={styles.chatBox}>
              <div className={styles.chatMessages}>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`${styles.chatMsg} ${m.sender_id === user?.id ? styles.chatMsgMe : ""}`}
                  >
                    <span className={styles.chatSender}>@{(m.sender as { username?: string })?.username ?? "?"}</span>
                    <span className={styles.chatBody}>{m.body}</span>
                    <span className={styles.chatTime}>{timeAgo(m.created_at)}</span>
                  </div>
                ))}
              </div>
              <div className={styles.chatInputRow}>
                <input
                  className={styles.chatInput}
                  placeholder="Type message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                />
                <button className={styles.btnPrimary} onClick={sendMessage} disabled={busy || !chatInput.trim()}>
                  Send
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.actionRow}>
              {selectedDeal.status === "created" && (selectedDeal as { seller_id?: string }).seller_id === user?.id && (
                <button className={styles.btnPrimary} onClick={() => runAction("accept", { deal_id: selectedDeal.id })} disabled={busy}>
                  Accept Deal
                </button>
              )}
              {selectedDeal.status === "accepted" && selectedDeal.buyer_id === user?.id && (
                selectedDeal.currency === "pi" ? (
                  <button
                    className={styles.btnPrimary}
                    onClick={async () => {
                      if (!selectedDeal || busy || piPaying) return;
                      const amount = Number(selectedDeal.amount_pi) || 0;
                      if (amount <= 0) { setMsg("Invalid amount"); return; }
                      setBusy(true);
                      setMsg("");
                      const dealId = selectedDeal.id;
                      try {
                        await ensurePaymentReady();
                        payWithPi({
                          amountPi: amount,
                          memo: `SupaScrow: ${selectedDeal.title}`,
                          type: "supascrow",
                          referenceId: dealId,
                          onSuccess: async () => {
                            setMsg("✅ Escrow funded!");
                            await fetchDealDetail(dealId);
                            await fetchDeals();
                            fetchScBalance();
                            setBusy(false);
                          },
                          onCancel: () => { setMsg("Payment cancelled"); setBusy(false); },
                          onError: (err) => { setMsg(`❌ ${err.message}`); setBusy(false); },
                        });
                      } catch (e: any) {
                        setMsg(`❌ ${e?.message ?? "Pi payment failed. Open in Pi Browser."}`);
                        setBusy(false);
                      }
                    }}
                    disabled={busy || piPaying}
                  >
                    {busy || piPaying ? "Opening Pi payment..." : "Fund Escrow (π)"}
                  </button>
                ) : (
                  <button className={styles.btnPrimary} onClick={() => runAction("fund", { deal_id: selectedDeal.id })} disabled={busy}>
                    Fund Escrow
                  </button>
                )
              )}
              {selectedDeal.status === "funded" && selectedDeal.seller_id === user?.id && (
                <div className={styles.trackingRow}>
                  <input
                    className={styles.input}
                    placeholder="Tracking number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                  <input
                    className={styles.input}
                    placeholder="Carrier"
                    value={trackingCarrier}
                    onChange={(e) => setTrackingCarrier(e.target.value)}
                  />
                  <button
                    className={styles.btnPrimary}
                    onClick={() => runAction("add_tracking", { deal_id: selectedDeal.id, tracking_number: trackingNumber, tracking_carrier: trackingCarrier })}
                    disabled={busy}
                  >
                    Mark Shipped
                  </button>
                </div>
              )}
              {selectedDeal.status === "shipped" && selectedDeal.buyer_id === user?.id && (
                <button className={styles.btnPrimary} onClick={() => runAction("confirm_delivery", { deal_id: selectedDeal.id })} disabled={busy}>
                  Confirm Delivery
                </button>
              )}
              {selectedDeal.status === "delivered" && selectedDeal.buyer_id === user?.id && (
                <>
                  {selectedDeal.currency === "pi" && !selectedDeal.seller?.can_receive_pi && (
                    <div className={styles.piWarning} role="alert">
                      <strong>Seller cannot receive Pi.</strong> They must sign in with Pi and activate their wallet before funds can be released.
                    </div>
                  )}
                  <button
                    className={styles.btnPrimary}
                    onClick={() => runAction("release", { deal_id: selectedDeal.id })}
                    disabled={busy || (selectedDeal.currency === "pi" && !selectedDeal.seller?.can_receive_pi)}
                  >
                    Release Funds to Seller
                  </button>
                </>
              )}
              {["created", "accepted"].includes(selectedDeal.status) && (
                <button className={styles.btnSecondary} onClick={() => runAction("cancel", { deal_id: selectedDeal.id })} disabled={busy}>
                  Cancel Deal
                </button>
              )}
              {["funded", "shipped", "delivered"].includes(selectedDeal.status) && (
                <div className={styles.disputeBlock}>
                  <textarea
                    className={styles.textarea}
                    placeholder="Reason for dispute (optional)"
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    rows={2}
                  />
                  <button
                    className={styles.btnSecondary}
                    onClick={() => runAction("dispute", { deal_id: selectedDeal.id, reason: disputeReason.trim() })}
                    disabled={busy}
                  >
                    Open Dispute
                  </button>
                </div>
              )}
            </div>

            {selectedDeal.tracking_number && (
              <div className={styles.trackingInfo}>
                📦 {selectedDeal.tracking_carrier ? `${selectedDeal.tracking_carrier}: ` : ""}
                {selectedDeal.tracking_number}
              </div>
            )}

            <button className={styles.modalClose} onClick={() => setSelectedDeal(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupaScrowPage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className={styles.introHero}>
          <div className={styles.heroBadge}>🔒 Secure Pi Escrow</div>
          <div className={styles.introIcon}>🛡️</div>
          <h1 className={styles.title}>SupaScrow</h1>
          <p className={styles.sub}>Loading...</p>
        </div>
      </div>
    }>
      <SupaScrowPageInner />
    </Suspense>
  );
}
