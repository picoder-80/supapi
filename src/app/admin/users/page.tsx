"use client";

// app/admin/users/page.tsx

import { useEffect, useState, useCallback } from "react";
import "@/styles/admin.css";

interface User {
  id: string; username: string; email: string | null;
  role: string; kyc_status: string; created_at: string;
  pi_balance_pending: number;
}

export default function UsersPage() {
  const [users,   setUsers]   = useState<User[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState("");
  const [role,    setRole]    = useState("");
  const [kyc,     setKyc]     = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), limit: "20",
      ...(search && { search }),
      ...(role   && { role }),
      ...(kyc    && { kyc }),
    });
    const res  = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    if (data.success) { setUsers(data.data.data); setTotal(data.data.total); }
    setLoading(false);
  }, [page, search, role, kyc]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const action = async (userId: string, act: string) => {
    const res  = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: act }),
    });
    const data = await res.json();
    if (data.success) fetchUsers();
    else alert(data.error);
  };

  const kycBadge = (s: string) =>
    s === "verified" ? "badgeGreen" : s === "pending" ? "badgeGold" : "badgeGray";

  const roleBadge = (r: string) =>
    r === "admin" ? "badgeBlue" : r === "banned" ? "badgeRed" : "badgeGray";

  return (
    <div>
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Users</h1>
          <p className="pageSub">{total.toLocaleString()} total users</p>
        </div>
      </div>

      <div className="filters">
        <input
          className="filterInput"
          placeholder="Search username or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="filterSelect" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          <option value="pioneer">Pioneer</option>
          <option value="seller">Seller</option>
          <option value="admin">Admin</option>
          <option value="banned">Banned</option>
        </select>
        <select className="filterSelect" value={kyc} onChange={(e) => { setKyc(e.target.value); setPage(1); }}>
          <option value="">All KYC</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      <div className="tableWrap">
        {loading ? (
          <div className="loading">Loading users...</div>
        ) : !users.length ? (
          <div className="empty">No users found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>KYC</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, color: "#E8E8F0" }}>
                    π {u.username}
                  </td>
                  <td style={{ color: "#7A7A8A" }}>{u.email ?? "—"}</td>
                  <td><span className={`badge ${roleBadge(u.role)}`}>{u.role}</span></td>
                  <td><span className={`badge ${kycBadge(u.kyc_status)}`}>{u.kyc_status}</span></td>
                  <td style={{ color: "#7A7A8A" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {u.kyc_status !== "verified" && (
                        <button className="actionBtn actionApprove" onClick={() => action(u.id, "verify_kyc")}>
                          Verify KYC
                        </button>
                      )}
                      {u.role !== "banned" && u.role !== "admin" && (
                        <button className="actionBtn actionRemove" onClick={() => action(u.id, "ban")}>
                          Ban
                        </button>
                      )}
                      {u.role === "banned" && (
                        <button className="actionBtn actionApprove" onClick={() => action(u.id, "unban")}>
                          Unban
                        </button>
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
            <button className="pageBtn" disabled={users.length < 20} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
