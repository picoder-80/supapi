"use client";

// app/admin/listings/page.tsx

import { useEffect, useState, useCallback } from "react";
import "@/styles/admin.css";

interface Listing {
  id: string; title: string; price_pi: number; category: string;
  status: string; is_featured: boolean; views_count: number;
  created_at: string; seller: { username: string; kyc_status: string } | null;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState("");
  const [loading,  setLoading]  = useState(true);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), limit: "20",
      ...(search && { search }),
      ...(status && { status }),
    });
    const res  = await fetch(`/api/admin/listings?${params}`);
    const data = await res.json();
    if (data.success) { setListings(data.data.data); setTotal(data.data.total); }
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const action = async (listingId: string, act: string) => {
    const res  = await fetch("/api/admin/listings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ listingId, action: act }),
    });
    const data = await res.json();
    if (data.success) fetchListings();
    else alert(data.error);
  };

  const statusBadge = (s: string) =>
    s === "active" ? "badgeGreen" : s === "removed" ? "badgeRed" : s === "pending" ? "badgeGold" : "badgeGray";

  return (
    <div>
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Listings</h1>
          <p className="pageSub">{total.toLocaleString()} total listings</p>
        </div>
      </div>

      <div className="filters">
        <input
          className="filterInput"
          placeholder="Search listing title..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="filterSelect" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="removed">Removed</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      <div className="tableWrap">
        {loading ? (
          <div className="loading">Loading listings...</div>
        ) : !listings.length ? (
          <div className="empty">No listings found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Seller</th>
                <th>Price</th>
                <th>Category</th>
                <th>Status</th>
                <th>Views</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600, color: "#E8E8F0", maxWidth: 200 }}>
                    {l.is_featured && <span style={{ color: "#F5A623", marginRight: 4 }}>★</span>}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", maxWidth: 180 }}>
                      {l.title}
                    </span>
                  </td>
                  <td style={{ color: "#7A7A8A" }}>
                    {l.seller?.username ?? "—"}
                    {l.seller?.kyc_status === "verified" && (
                      <span style={{ color: "#2ECC71", marginLeft: 4, fontSize: 10 }}>✓</span>
                    )}
                  </td>
                  <td style={{ color: "#F5A623", fontWeight: 700 }}>π {l.price_pi}</td>
                  <td><span className="badge badgeGray">{l.category}</span></td>
                  <td><span className={`badge ${statusBadge(l.status)}`}>{l.status}</span></td>
                  <td style={{ color: "#7A7A8A" }}>{l.views_count}</td>
                  <td>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {l.status !== "active"   && <button className="actionBtn actionApprove" onClick={() => action(l.id, "approve")}>Approve</button>}
                      {l.status !== "removed"  && <button className="actionBtn actionRemove"  onClick={() => action(l.id, "remove")}>Remove</button>}
                      {l.status === "active"   && <button className="actionBtn actionFlag"    onClick={() => action(l.id, "flag")}>Flag</button>}
                      {!l.is_featured          && <button className="actionBtn actionNeutral" onClick={() => action(l.id, "feature")}>Feature</button>}
                      {l.is_featured           && <button className="actionBtn actionNeutral" onClick={() => action(l.id, "unfeature")}>Unfeature</button>}
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
            <button className="pageBtn" disabled={listings.length < 20} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
