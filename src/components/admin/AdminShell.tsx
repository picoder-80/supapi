"use client";

// components/admin/AdminShell.tsx

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./AdminShell.module.css";

const ADMIN_TOKEN_KEY = "supapi_admin_token";

const navItems = [
  { href: "/admin/dashboard",  icon: "▦",  label: "Dashboard"  },
  { href: "/admin/users",      icon: "👥", label: "Users"       },
  { href: "/admin/listings",   icon: "🛍️", label: "Listings"    },
  { href: "/admin/orders",     icon: "📦", label: "Orders"      },
  { href: "/admin/analytics",  icon: "📊", label: "Analytics"   },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname();
  const router      = useRouter();
  const [signingOut, setSigningOut]   = useState(false);
  const [authorized, setAuthorized]   = useState(false);
  const [checking,   setChecking]     = useState(true);

  // Check admin token in localStorage
  useEffect(() => {
    if (pathname === "/admin/login") {
      setChecking(false);
      return;
    }

    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      router.replace("/admin/login");
    } else {
      setAuthorized(true);
      setChecking(false);
    }
  }, [pathname, router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    await fetch("/api/admin/auth", { method: "DELETE" });
    window.location.replace("/admin/login");
  };

  // Login page — no shell
  if (pathname === "/admin/login") return <>{children}</>;

  // Checking auth
  if (checking) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
      <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Loading...</span>
    </div>
  );

  // Not authorized
  if (!authorized) return null;

  const currentLabel = navItems.find(n => pathname.startsWith(n.href))?.label ?? "Admin";

  return (
    <div className={styles.shell}>
      {/* ── Sidebar (desktop) ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span className={styles.logoMark}>π</span>
          <div>
            <div className={styles.logoTitle}>Supapi</div>
            <span className={styles.logoBadge}>ADMIN</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${pathname.startsWith(item.href) ? styles.navActive : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {pathname.startsWith(item.href) && <span className={styles.navPip} />}
            </Link>
          ))}
        </nav>

        <button onClick={handleSignOut} disabled={signingOut} className={styles.signOutBtn}>
          <span>🚪</span>
          <span>{signingOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        {/* Mobile topbar */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.topbarMark}>π</span>
            <span className={styles.topbarPage}>{currentLabel}</span>
          </div>
          <button onClick={handleSignOut} className={styles.topbarSignOut}>🚪</button>
        </div>

        <div className={styles.content}>
          {children}
        </div>

        {/* Mobile bottom nav */}
        <nav className={styles.bottomNav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.bottomItem} ${pathname.startsWith(item.href) ? styles.bottomActive : ""}`}
            >
              <span className={styles.bottomIcon}>{item.icon}</span>
              <span className={styles.bottomLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}