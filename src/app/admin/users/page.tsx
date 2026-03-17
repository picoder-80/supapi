"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

interface User {
  id: string; username: string; email: string | null;
  role: string; kyc_status: string; created_at: string;
}

export default function UsersPage() {
  const LIMIT = 20;
  const [users,   setUsers]   = useState<User[]>([]);
  const [roles,   setRoles]   = useState<string[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState("");
  const [role,    setRole]    = useState("");
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErr("");
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    const params = new URLSearchParams({
      page: String(page), limit: String(LIMIT),
      ...(search && { q: search }),
      ...(role   && { role }),
    });
    try {
      const res  = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const list = data?.data?.users ?? data?.data?.data ?? [];
        setUsers(Array.isArray(list) ? list : []);
        const roleList = data?.data?.available_roles ?? [];
        setRoles(Array.isArray(roleList) ? roleList : []);
        setTotal(Number(data?.data?.total ?? 0));
      } else {
        setUsers([]);
        setRoles([]);
        setTotal(0);
        setErr(data?.error ?? "Failed to load users");
      }
    } catch {
      setUsers([]);
      setRoles([]);
      setTotal(0);
      setErr("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search, role, LIMIT]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const action = async (userId: string, act: "ban" | "unban") => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    const res  = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_banned: act === "ban" }),
    });
    const data = await res.json();
    if (data.success) fetchUsers();
    else alert(data.error);
  };

  const roleColor: Record<string, string> = {
    admin: "#F5A623", banned: "#e74c3c", seller: "#3498db", pioneer: "#999"
  };

  return (
    <div className="adminPage">
      <AdminPageHero
        icon="👥"
        title="Users"
        subtitle="Manage user directory, review roles, and run moderation actions"
      />

      <div className="adminSection">
        <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          placeholder="Search username or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className={styles.select} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          <option value="kyc_pioneer">KYC&apos;ed Pioneer</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
      </div>

        <div className={styles.userCount}>{total.toLocaleString()} total users</div>
        {!!err && <div className={styles.userCount} style={{ color: "#e74c3c" }}>{err}</div>}

        {loading ? (
          <div className="adminLoading">Loading users...</div>
        ) : !users.length ? (
          <div className="adminEmpty">No users found.</div>
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
                  {u.kyc_status === "verified" && (
                    <span className={styles.kycTag}>KYC&apos;ed</span>
                  )}
                </div>
                <div className={styles.userSub}>{u.email ?? "—"} · Joined {new Date(u.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
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
        <span>Page {page} / {totalPages} · {total} total</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={styles.pageBtn} disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <button className={styles.pageBtn} disabled={loading || page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
        </div>
      </div>

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>
    </div>
  );
}