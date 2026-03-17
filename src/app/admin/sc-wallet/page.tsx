"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

type SCResponse = {
  summary: {
    total_balance: number;
    total_earned: number;
    total_spent: number;
    active_wallets: number;
    total_wallets: number;
  };
  available_types: string[];
  available_activities: string[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  recent_transactions: Array<{
    id: string;
    user_id: string;
    type: string;
    activity: string;
    amount: number;
    balance_after: number;
    note: string | null;
    created_at: string;
    user: { username?: string; display_name?: string | null } | null;
  }>;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

function formatActivityLabel(activity: string) {
  const key = String(activity ?? "").trim();
  if (!key) return "Unknown";

  // Backward compatibility for old marketplace event naming.
  if (key === "first_listing") return "SupaMarket First Listing";

  const firstListingMatch = key.match(/^([a-z0-9]+)_first_listing$/i);
  if (firstListingMatch) {
    const platform = firstListingMatch[1]
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
    return `${platform} First Listing`;
  }

  const firstByTypeMatch = key.match(/^([a-z0-9]+)_first_([a-z0-9_]+)$/i);
  if (firstByTypeMatch) {
    const platform = firstByTypeMatch[1]
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
    const listingType = firstByTypeMatch[2]
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
    return `${platform} First ${listingType}`;
  }

  const alias: Record<string, string> = {
    buy_sc: "Buy SC",
    gift_sent: "Gift Sent",
    gift_received: "Gift Received",
    transfer_in: "Transfer In",
    transfer_out: "Transfer Out",
    referral_reward: "Referral Reward",
    first_supa_saylo_post: "First SupaSaylo Post",
    first_supa_livvi_post: "First SupaLivvi Post",
  };
  if (alias[key]) return alias[key];
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function AdminSCWalletPage() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [activity, setActivity] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SCResponse | null>(null);

  const fetchData = async (nextQ: string, nextType: string, nextActivity: string, nextPage = 1) => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    setLoading(true);
    const params = new URLSearchParams({
      limit: "10",
      page: String(nextPage),
      q: nextQ,
      type: nextType,
      activity: nextActivity,
    });
    try {
      const r = await fetch(`/api/admin/sc-wallet?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) {
        setData(d.data);
        setPage(Number(d.data?.pagination?.page ?? nextPage));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData("", "", "", 1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(q, type, activity, 1);
    }, 350);
    return () => clearTimeout(timer);
  }, [q, type, activity]);

  const exportCsv = async () => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    const params = new URLSearchParams({
      q,
      type,
      activity,
      format: "csv",
      limit: "100",
    });
    const r = await fetch(`/api/admin/sc-wallet?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sc-wallet-transactions-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Total SC Balance", value: `${data.summary.total_balance.toFixed(2)} SC` },
      { label: "Total SC Earned", value: `${data.summary.total_earned.toFixed(2)} SC` },
      { label: "Total SC Spent", value: `${data.summary.total_spent.toFixed(2)} SC` },
      { label: "Active Wallets", value: `${data.summary.active_wallets}/${data.summary.total_wallets}` },
    ];
  }, [data]);

  return (
    <div className="adminPage">
      <AdminPageHero
        icon="💎"
        title="Supa Credits Admin Wallet"
        subtitle="Monitor wallet analytics, filter activities, and export transaction data"
      />

      <div className="adminSection">
        <div className={styles.filterRow}>
        <input
          className={styles.input}
          placeholder="Search username/activity/note..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          {(data?.available_types ?? []).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className={styles.select} value={activity} onChange={(e) => setActivity(e.target.value)}>
          <option value="">All Activities</option>
          {(data?.available_activities ?? []).map((a) => (
            <option key={a} value={a}>{formatActivityLabel(a)}</option>
          ))}
        </select>
        <button className={styles.btn} onClick={() => fetchData(q, type, activity, 1)}>Apply</button>
        <button className={styles.btn} onClick={exportCsv}>Export CSV</button>
        </div>

        <div className={styles.grid}>
        {summaryCards.map((card) => (
          <div key={card.label} className="adminCard">
            <div className="adminCardLabel">{card.label}</div>
            <div className="adminCardValue">{card.value}</div>
          </div>
        ))}
        </div>

        <div className="adminSectionRow" style={{ marginBottom: 0 }}>
          <h2 className="adminSectionTitle">Recent SC Transactions</h2>
        </div>
        {!!data?.pagination && (
          <div className={styles.pagerMeta}>
            Showing page {data.pagination.page}/{data.pagination.total_pages} · {data.pagination.total} result(s)
          </div>
        )}
        {loading ? (
          <div className="adminLoading">Loading...</div>
        ) : !data?.recent_transactions?.length ? (
          <div className="adminEmpty">No transactions found.</div>
        ) : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Activity</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>@{tx.user?.username ?? "unknown"}</td>
                    <td>{tx.type}</td>
                    <td>{formatActivityLabel(tx.activity)}</td>
                    <td>{Number(tx.amount).toFixed(2)} SC</td>
                    <td>{Number(tx.balance_after).toFixed(2)} SC</td>
                    <td>{fmtDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!!data?.pagination && data.pagination.total_pages > 1 && (
          <div className={styles.pagerRow}>
            <button
              className={styles.btn}
              disabled={loading || data.pagination.page <= 1}
              onClick={() => fetchData(q, type, activity, data.pagination.page - 1)}
            >
              ← Prev
            </button>
            <button
              className={styles.btn}
              disabled={loading || data.pagination.page >= data.pagination.total_pages}
              onClick={() => fetchData(q, type, activity, data.pagination.page + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>
    </div>
  );
}
