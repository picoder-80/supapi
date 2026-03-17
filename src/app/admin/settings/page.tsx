"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";

type AdminItem = {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string;
  role_label: string;
  created_at: string;
  last_login: string | null;
};

type RoleOption = { value: string; label: string };

type SettingsResponse = {
  me: AdminItem;
  capabilities: {
    can_create_admin: boolean;
  };
  admins: AdminItem[];
  role_options: RoleOption[];
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [msg, setMsg] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [pass, setPass] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [createForm, setCreateForm] = useState({
    username: "",
    display_name: "",
    email: "",
    password: "",
    admin_role: "admin",
  });

  const fetchSettings = async () => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (payload.success) {
        setData(payload.data);
        if (payload.data?.role_options?.length) {
          setCreateForm((prev) => ({ ...prev, admin_role: payload.data.role_options[0].value }));
        }
      } else {
        setMsg(`❌ ${payload.error ?? "Failed to load settings"}`);
      }
    } catch {
      setMsg("❌ Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const changePassword = async () => {
    if (!pass.current_password || !pass.new_password) {
      setMsg("❌ Please fill current and new password");
      return;
    }
    if (pass.new_password !== pass.confirm_password) {
      setMsg("❌ New password confirmation does not match");
      return;
    }
    setSavingPass(true);
    setMsg("");
    try {
      const token = localStorage.getItem("supapi_admin_token") ?? "";
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: pass.current_password,
          new_password: pass.new_password,
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        setMsg("✅ Password updated");
        setPass({ current_password: "", new_password: "", confirm_password: "" });
      } else {
        setMsg(`❌ ${payload.error ?? "Failed to update password"}`);
      }
    } catch {
      setMsg("❌ Failed to update password");
    } finally {
      setSavingPass(false);
    }
  };

  const createAdmin = async () => {
    if (!createForm.username || !createForm.email || !createForm.password || !createForm.admin_role) {
      setMsg("❌ Please complete new admin form");
      return;
    }
    setSavingCreate(true);
    setMsg("");
    try {
      const token = localStorage.getItem("supapi_admin_token") ?? "";
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });
      const payload = await res.json();
      if (payload.success) {
        setMsg("✅ New admin created");
        setCreateForm((prev) => ({ ...prev, username: "", display_name: "", email: "", password: "" }));
        await fetchSettings();
      } else {
        setMsg(`❌ ${payload.error ?? "Failed to create admin"}`);
      }
    } catch {
      setMsg("❌ Failed to create admin");
    } finally {
      setSavingCreate(false);
    }
  };

  return (
    <div className="adminPage">
      <AdminPageHero
        icon="⚙️"
        title="Admin Settings"
        subtitle="Manage security controls, update passwords, and provision admin accounts"
      />

      {!!msg && <div className="adminMsg">{msg}</div>}

      {loading ? (
        <div className="adminLoading">Loading settings...</div>
      ) : (
        <>
          <div className="adminContentCard">
            <div className="adminContentCardTitle">Your Admin Account</div>
            <div className="adminKvRow"><span>Username</span><strong>@{data?.me?.username ?? "—"}</strong></div>
            <div className="adminKvRow"><span>Email</span><strong>{data?.me?.email ?? "—"}</strong></div>
            <div className="adminKvRow"><span>Role</span><strong>{data?.me?.role_label ?? "—"}</strong></div>
            <div className="adminKvRow"><span>Created</span><strong>{fmtDate(data?.me?.created_at)}</strong></div>
          </div>

          <div className="adminContentCard">
            <div className="adminContentCardTitle">Change Password</div>
            <div className="adminFormGrid">
              <input
                className="adminInput"
                type="password"
                placeholder="Current password"
                value={pass.current_password}
                onChange={(e) => setPass((p) => ({ ...p, current_password: e.target.value }))}
              />
              <input
                className="adminInput"
                type="password"
                placeholder="New password (min 8 chars)"
                value={pass.new_password}
                onChange={(e) => setPass((p) => ({ ...p, new_password: e.target.value }))}
              />
              <input
                className="adminInput"
                type="password"
                placeholder="Confirm new password"
                value={pass.confirm_password}
                onChange={(e) => setPass((p) => ({ ...p, confirm_password: e.target.value }))}
              />
            </div>
            <button className="adminPrimaryBtn" disabled={savingPass} onClick={changePassword}>
              {savingPass ? "Updating..." : "Update Password"}
            </button>
          </div>

          {data?.capabilities?.can_create_admin && (
            <div className="adminContentCard">
              <div className="adminContentCardTitle">Create Admin Account</div>
              <div className="adminFormGrid">
                <input
                  className="adminInput"
                  placeholder="Username"
                  value={createForm.username}
                  onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))}
                />
                <input
                  className="adminInput"
                  placeholder="Display name (optional)"
                  value={createForm.display_name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, display_name: e.target.value }))}
                />
                <input
                  className="adminInput"
                  type="email"
                  placeholder="Email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                />
                <input
                  className="adminInput"
                  type="password"
                  placeholder="Temporary password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                />
                <select
                  className="adminInput adminSelect"
                  value={createForm.admin_role}
                  onChange={(e) => setCreateForm((p) => ({ ...p, admin_role: e.target.value }))}
                >
                  {(data?.role_options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button className="adminPrimaryBtn" disabled={savingCreate} onClick={createAdmin}>
                {savingCreate ? "Creating..." : "Create Admin"}
              </button>
            </div>
          )}

          <div className="adminContentCard">
            <div className="adminContentCardTitle">Current Admin Accounts</div>
            {!data?.admins?.length ? (
              <div className="adminEmpty">No admin accounts found.</div>
            ) : (
              <div className="adminTableWrap">
                <table className="adminTable">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Created</th>
                      <th>Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.admins.map((a) => (
                      <tr key={a.id}>
                        <td>@{a.username}</td>
                        <td>{a.email ?? "—"}</td>
                        <td>{a.role_label}</td>
                        <td>{fmtDate(a.created_at)}</td>
                        <td>{fmtDate(a.last_login)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="adminQuickLinks">
            <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
          </div>
        </>
      )}
    </div>
  );
}
