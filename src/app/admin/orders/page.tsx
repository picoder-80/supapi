"use client";

// app/admin/orders/page.tsx

import { useEffect, useState, useCallback } from "react";
import "@/styles/admin.css";

interface Order {
  id: string; price_pi: number; status: string; escrow_released: boolean;
  created_at: string;
  gig:    { title: string } | null;
  buyer:  { username: string } | null;
  seller: { username: string } | null;
}

export default function OrdersPage() {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), limit: "20",
      ...(status && { status }),
    });
    const res  = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    if (data.success) { setOrders(data.data.data); setTotal(data.data.total); }
    setLoading(false);
  }, [page, status]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const action = async (orderId: string, act: string) => {
    if (!confirm(`Are you sure you want to ${act.replace("_", " ")} this order?`)) return;
    const res  = await fetch("/api/admin/orders", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ orderId, action: act }),
    });
    const data = await res.json();
    if (data.success) fetchOrders();
    else alert(data.error);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      completed: "badgeGreen", disputed: "badgeRed", cancelled: "badgeGray",
      pending: "badgeGold", in_progress: "badgeBlue", delivered: "badgeBlue",
    };
    return map[s] ?? "badgeGray";
  };

  return (
    <div>
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Orders & Disputes</h1>
          <p className="pageSub">{total.toLocaleString()} total orders</p>
        </div>
      </div>

      <div className="filters">
        <select className="filterSelect" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All status</option>
          <option value="disputed">⚠ Disputed</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="tableWrap">
        {loading ? (
          <div className="loading">Loading orders...</div>
        ) : !orders.length ? (
          <div className="empty">No orders found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Gig</th>
                <th>Buyer</th>
                <th>Seller</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Escrow</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={o.status === "disputed" ? { background: "rgba(231,76,60,0.04)" } : {}}>
                  <td style={{ fontWeight: 600, color: "#E8E8F0", maxWidth: 160 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", maxWidth: 150 }}>
                      {o.gig?.title ?? "—"}
                    </span>
                  </td>
                  <td style={{ color: "#7A7A8A" }}>{o.buyer?.username  ?? "—"}</td>
                  <td style={{ color: "#7A7A8A" }}>{o.seller?.username ?? "—"}</td>
                  <td style={{ color: "#F5A623", fontWeight: 700 }}>π {o.price_pi}</td>
                  <td><span className={`badge ${statusBadge(o.status)}`}>{o.status.replace("_"," ")}</span></td>
                  <td>
                    <span className={`badge ${o.escrow_released ? "badgeGreen" : "badgeGray"}`}>
                      {o.escrow_released ? "Released" : "Held"}
                    </span>
                  </td>
                  <td style={{ color: "#7A7A8A" }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {o.status === "disputed" && (
                        <>
                          <button className="actionBtn actionApprove" onClick={() => action(o.id, "resolve_seller")}>→ Seller</button>
                          <button className="actionBtn actionRemove"  onClick={() => action(o.id, "resolve_buyer")}>→ Buyer</button>
                        </>
                      )}
                      {["pending","in_progress","delivered"].includes(o.status) && (
                        <button className="actionBtn actionFlag" onClick={() => action(o.id, "force_complete")}>Force Complete</button>
                      )}
                      {o.status !== "cancelled" && o.status !== "completed" && (
                        <button className="actionBtn actionNeutral" onClick={() => action(o.id, "cancel")}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="pagination">
          <span>Page {page} · {total} total</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pageBtn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <button className="pageBtn" disabled={orders.length < 20} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
