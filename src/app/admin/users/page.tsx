"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

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
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    const params = new URLSearchParams({
      page: String(page), limit: "20",
      ...(search && { search }),
      ...(role   && { role }),
      ...(kyc    && { kyc }),
    });
    const res  = await fetch(`/api/admin/users?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) { setUsers(data.data.data); setTotal(data.data.total); }
    setLoading(false);
  }, [page, search, role, kyc]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const action = async (userId: string, act: string) => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    const res  = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, action: act }),
    });
    const data = await res.json();
    if (data.success) fetchUsers();
    else alert(data.error);
  };

  const kycColor: Record<string, string> = {
    verified: "#27ae60", pending: "#f39c12", unverified: "#999"
  };
  const roleColor: Record<string, string> = {
    admin: "#F5A623", banned: "#e74c3c", seller: "#3498db", pioneer: "#999"
  };

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <h1 className={styles.title}>👥 Users</h1>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          placeholder="Search username or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className={styles.select} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          <option value="pioneer">Pioneer</option>
          <option value="seller">Seller</option>
          <option value="admin">Admin</option>
          <option value="banned">Banned</option>
        </select>
        <select className={styles.select} value={kyc} onChange={(e) => { setKyc(e.target.value); setPage(1); }}>
          <option value="">All KYC</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      <div className={styles.userCount}>{total.toLocaleString()} total users</div>

      {loading ? (
        <div className={styles.loading}>Loading users...</div>
      ) : !users.length ? (
        <div className={styles.empty}>No users found.</div>
      ) : (
        <div className={styles.userList}>
          {users.map((u) => (
            <div key={u.id} className={`${styles.userRow} ${u.role === "banned" ? styles.userRowBanned : ""}`}>
              <div className={styles.userAvatar}>
                {u.username?.charAt(0).toUpperCase()}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>
                  π {u.username}
                  <span className={styles.adminTag} style={{ background: `${roleColor[u.role] ?? "#999"}18`, color: roleColor[u.role] ?? "#999" }}>
                    {u.role}
                  </span>
                  <span className={styles.bannedTag} style={{ background: `${kycColor[u.kyc_status] ?? "#999"}18`, color: kycColor[u.kyc_status] ?? "#999" }}>
                    {u.kyc_status}
                  </span>
                </div>
                <div className={styles.userSub}>{u.email ?? "—"} · Joined {new Date(u.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {u.kyc_status !== "verified" && (
                  <button className={styles.okBtn} onClick={() => action(u.id, "verify_kyc")}>Verify KYC</button>
                )}
                {u.role !== "banned" && u.role !== "admin" && (
                  <button className={styles.dangerBtn} onClick={() => action(u.id, "ban")}>Ban</button>
                )}
                {u.role === "banned" && (
                  <button className={styles.okBtn} onClick={() => action(u.id, "unban")}>Unban</button>
                )}
                <Link href={`/admin/users/${u.id}`} className={styles.viewBtn}>View →</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.pagination}>
        <span>Page {page} · {total} total</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <button className={styles.pageBtn} disabled={users.length < 20} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      </div>

    </div>
  );
}