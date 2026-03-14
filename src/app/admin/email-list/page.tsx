"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type EmailItem = {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  role: string | null;
  kyc_status: string | null;
  created_at: string | null;
};

type EmailListResponse = {
  rows: EmailItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

type ProviderOption = {
  value: "auto" | "custom_api" | "resend";
  label: string;
  configured?: boolean;
};

type BlastConfigResponse = {
  options: ProviderOption[];
  active_provider: "custom_api" | "resend" | "unconfigured";
  custom_api_configured: boolean;
  resend_configured: boolean;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminEmailListPage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState("");
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EmailListResponse | null>(null);
  const [msg, setMsg] = useState("");
  const [blastMsg, setBlastMsg] = useState("");
  const [blastSubject, setBlastSubject] = useState("");
  const [blastText, setBlastText] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [useSelectedOnly, setUseSelectedOnly] = useState(false);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [providerPreference, setProviderPreference] = useState<"auto" | "custom_api" | "resend">("auto");
  const [blastConfig, setBlastConfig] = useState<BlastConfigResponse | null>(null);

  const fetchData = async (nextQ: string, nextPage = 1, nextIncludeUnverified = includeUnverified) => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams({
        q: nextQ,
        page: String(nextPage),
        limit: "100",
        include_unverified: nextIncludeUnverified ? "true" : "false",
      });
      const r = await fetch(`/api/admin/email-list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d?.success) {
        setData(d.data);
        setPage(Number(d.data?.page ?? nextPage));
      } else {
        setData(null);
        setMsg(`❌ ${d?.error ?? "Failed to load email list"}`);
      }
    } catch {
      setData(null);
      setMsg("❌ Failed to load email list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData("", 1, false);
  }, []);

  useEffect(() => {
    const fetchBlastConfig = async () => {
      const token = localStorage.getItem("supapi_admin_token") ?? "";
      try {
        const r = await fetch("/api/admin/email-list/blast", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (d?.success) setBlastConfig(d.data as BlastConfigResponse);
      } catch {
        setBlastConfig(null);
      }
    };
    fetchBlastConfig();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(q, 1, includeUnverified);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, includeUnverified]);

  const exportCsv = async () => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    const params = new URLSearchParams({
      q,
      format: "csv",
      limit: "500",
      include_unverified: includeUnverified ? "true" : "false",
    });
    const r = await fetch(`/api/admin/email-list?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pioneer-email-list-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const runBlast = async () => {
    if (!canSendWithProvider) {
      setBlastMsg(`❌ Selected provider "${providerPreference}" is not configured yet`);
      return;
    }
    if (!blastSubject.trim() || !blastText.trim()) {
      setBlastMsg("❌ Please fill campaign subject and message");
      return;
    }
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    setSending(true);
    setBlastMsg("");
    try {
      const r = await fetch("/api/admin/email-list/blast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          q,
          include_unverified: includeUnverified,
          dry_run: dryRun,
          subject: blastSubject.trim(),
          text: blastText.trim(),
          selected_emails: useSelectedOnly && !selectAllMatching ? selectedEmails : [],
          select_all_matching: selectAllMatching,
          provider: providerPreference,
          limit: 2000,
        }),
      });
      const d = await r.json();
      if (d?.success) {
        if (dryRun) {
          const count = Number(d?.data?.recipients_count ?? 0);
          if (selectAllMatching) {
            const total = Number(d?.data?.total_matched_count ?? count);
            setBlastMsg(`✅ Preview ready · ${count} recipient(s) prepared from total ${total} matched`);
          } else {
            setBlastMsg(`✅ Preview ready · ${count} recipient(s) matched`);
          }
        } else {
          const sent = Number(d?.data?.sent_count ?? 0);
          const total = Number(d?.data?.recipients_count ?? sent);
          setBlastMsg(`✅ Blast sent · ${sent}/${total}`);
        }
      } else {
        setBlastMsg(`❌ ${d?.error ?? "Blast failed"}`);
      }
    } catch {
      setBlastMsg("❌ Blast failed");
    } finally {
      setSending(false);
    }
  };

  const runTestEmail = async () => {
    if (!canSendWithProvider) {
      setBlastMsg(`❌ Selected provider "${providerPreference}" is not configured yet`);
      return;
    }
    if (!blastSubject.trim() || !blastText.trim()) {
      setBlastMsg("❌ Please fill campaign subject and message");
      return;
    }
    if (!testEmail.trim()) {
      setBlastMsg("❌ Please enter test recipient email");
      return;
    }
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    setSending(true);
    setBlastMsg("");
    try {
      const r = await fetch("/api/admin/email-list/blast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: blastSubject.trim(),
          text: blastText.trim(),
          test_email: testEmail.trim(),
          provider: providerPreference,
          dry_run: false,
        }),
      });
      const d = await r.json();
      if (d?.success) {
        setBlastMsg(`✅ Test email sent to ${testEmail.trim()}`);
      } else {
        setBlastMsg(`❌ ${d?.error ?? "Test send failed"}`);
      }
    } catch {
      setBlastMsg("❌ Test send failed");
    } finally {
      setSending(false);
    }
  };

  const rowsWithEmail = (data?.rows ?? []).filter((r) => Boolean(String(r.email ?? "").trim()));
  const providerOptions: ProviderOption[] = blastConfig?.options ?? [
    { value: "auto", label: "Auto" },
    { value: "custom_api", label: "Custom API", configured: false },
    { value: "resend", label: "Resend", configured: false },
  ];
  const displayProviderOptions: ProviderOption[] = providerOptions.map((option) => {
    if (option.value !== "auto") return option;
    const noProviderConfigured = blastConfig?.active_provider === "unconfigured";
    return {
      ...option,
      label: noProviderConfigured ? "Auto (no provider configured)" : "Auto",
    };
  });
  const selectedProviderConfigured =
    providerPreference === "auto"
      ? blastConfig?.active_provider !== "unconfigured"
      : providerPreference === "custom_api"
        ? Boolean(blastConfig?.custom_api_configured)
        : Boolean(blastConfig?.resend_configured);
  const providerConfigReady = blastConfig !== null;
  const canSendWithProvider = providerConfigReady ? selectedProviderConfigured : true;
  const allCurrentChecked =
    rowsWithEmail.length > 0 &&
    rowsWithEmail.every((r) => selectedEmails.includes(String(r.email ?? "").trim().toLowerCase()));

  const toggleEmail = (emailRaw: string, checked: boolean) => {
    const email = String(emailRaw ?? "").trim().toLowerCase();
    if (!email) return;
    setSelectedEmails((prev) => {
      if (checked) return prev.includes(email) ? prev : [...prev, email];
      return prev.filter((e) => e !== email);
    });
  };

  const toggleAllCurrent = (checked: boolean) => {
    const currentEmails = rowsWithEmail.map((r) => String(r.email ?? "").trim().toLowerCase()).filter(Boolean);
    setSelectedEmails((prev) => {
      if (checked) return [...new Set([...prev, ...currentEmails])];
      const set = new Set(currentEmails);
      return prev.filter((e) => !set.has(e));
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.icon}>📧</span>
          <div>
            <h1 className={styles.title}>Email List</h1>
            <p className={styles.sub}>Pioneer email list for upcoming marketing blast integrations</p>
          </div>
        </div>
        <Link href="/admin/dashboard" className={`${styles.backBtn} ${styles.topBackBtn}`}>Back to Dashboard</Link>
      </div>

      <div className={styles.card}>
        <div className={styles.filterRow}>
          <input
            className={styles.input}
            placeholder="Search username/display name/email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className={styles.checkboxWrap}>
            <input
              type="checkbox"
              checked={includeUnverified}
              onChange={(e) => setIncludeUnverified(e.target.checked)}
            />
            Include unverified KYC
          </label>
          <button className={styles.btn} onClick={exportCsv}>Export CSV</button>
        </div>

        {!!msg && <div className={styles.msg}>{msg}</div>}
        {!!data && (
          <div className={styles.meta}>
            Showing page {data.page}/{data.total_pages} · {data.total} pioneer email(s)
          </div>
        )}

        {loading ? (
          <div className={styles.empty}>Loading pioneer emails...</div>
        ) : !data?.rows?.length ? (
          <div className={styles.empty}>No pioneer emails found.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allCurrentChecked}
                      onChange={(e) => toggleAllCurrent(e.target.checked)}
                      aria-label="Select all recipients on this page"
                    />
                  </th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>KYC</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(String(row.email ?? "").trim().toLowerCase())}
                        onChange={(e) => toggleEmail(String(row.email ?? ""), e.target.checked)}
                        disabled={!row.email}
                        aria-label={`Select ${row.email ?? row.username ?? "recipient"}`}
                      />
                    </td>
                    <td>@{row.username ?? "unknown"}</td>
                    <td>{row.email ?? "—"}</td>
                    <td>{row.kyc_status ?? "—"}</td>
                    <td>{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!!data?.total_pages && data.total_pages > 1 && (
          <div className={styles.pager}>
            <button
              className={styles.btn}
              disabled={loading || data.page <= 1}
              onClick={() => fetchData(q, data.page - 1, includeUnverified)}
            >
              ← Prev
            </button>
            <button
              className={styles.btn}
              disabled={loading || data.page >= data.total_pages}
              onClick={() => fetchData(q, data.page + 1, includeUnverified)}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.sectionTitle}>Email Blast Campaign</div>
        <div className={styles.note}>
          This sends campaign emails to Pioneer recipients from current filters. Start with preview first.
        </div>
        <div className={styles.providerRow}>
          <div className={styles.providerLabel}>Provider</div>
          <div className={styles.providerOptions}>
            {displayProviderOptions.map((option) => {
              const configured =
                option.value === "auto" ? true : Boolean(option.configured);
              return (
                <label key={option.value} className={styles.providerOption}>
                  <input
                    type="radio"
                    name="provider"
                    value={option.value}
                    checked={providerPreference === option.value}
                    onChange={() => setProviderPreference(option.value)}
                  />
                  <span>{option.label}</span>
                  {option.value !== "auto" && (
                    <span className={configured ? styles.statusConfigured : styles.statusNotConfigured}>
                      {configured ? "configured" : "not configured"}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {!!blastConfig && (
            <div className={styles.providerMeta}>
              Active (Auto): {blastConfig.active_provider === "unconfigured" ? "not configured" : blastConfig.active_provider}
            </div>
          )}
          {!canSendWithProvider && (
            <div className={styles.providerWarning}>
              Selected provider is not configured. Update env settings first.
            </div>
          )}
        </div>
        <div className={styles.formGrid}>
          <input
            className={styles.input}
            placeholder="Campaign subject"
            value={blastSubject}
            onChange={(e) => setBlastSubject(e.target.value)}
          />
          <textarea
            className={styles.textarea}
            placeholder="Campaign message body..."
            value={blastText}
            onChange={(e) => setBlastText(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Test recipient email (you@domain.com)"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
        </div>
        <div className={styles.filterRow}>
          <label className={styles.checkboxWrap}>
            <input
              type="checkbox"
              checked={selectAllMatching}
              onChange={(e) => {
                const checked = e.target.checked;
                setSelectAllMatching(checked);
                if (checked) setUseSelectedOnly(false);
              }}
            />
            Select all matched ({Number(data?.total ?? 0)})
          </label>
          <label className={styles.checkboxWrap}>
            <input
              type="checkbox"
              checked={useSelectedOnly}
              onChange={(e) => {
                const checked = e.target.checked;
                setUseSelectedOnly(checked);
                if (checked) setSelectAllMatching(false);
              }}
              disabled={selectedEmails.length === 0 || selectAllMatching}
            />
            Selected only ({selectedEmails.length})
          </label>
          <label className={styles.checkboxWrap}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Preview only (do not send)
          </label>
          <button className={styles.btn} disabled={sending || !canSendWithProvider} onClick={runBlast}>
            {sending ? "Processing..." : dryRun ? "Preview Recipients" : "Send Blast Now"}
          </button>
          <button className={styles.btnSecondary} disabled={sending || !canSendWithProvider} onClick={runTestEmail}>
            {sending ? "Processing..." : "Send Test Email"}
          </button>
        </div>
        {!!blastMsg && <div className={styles.msg}>{blastMsg}</div>}
      </div>

      <div className={styles.quickLinks}>
        <Link href="/admin/dashboard" className={`${styles.backBtn} ${styles.bottomBackBtn}`}>Back to Dashboard</Link>
      </div>
    </div>
  );
}
