"use client";

// components/admin/AdminShell.tsx

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./AdminShell.module.css";

const navItems = [
  { href: "/admin/dashboard",  icon: "▦",  label: "Dashboard"  },
  { href: "/admin/users",      icon: "👥", label: "Users"       },
  { href: "/admin/listings",   icon: "🛍️", label: "Listings"    },
  { href: "/admin/orders",     icon: "📦", label: "Orders"      },
  { href: "/admin/analytics",  icon: "📊", label: "Analytics"   },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  // Don't render shell on login page
  if (pathname === "/admin/login") return <>{children}</>;

  const handleSignOut = async () => {
    setSigningOut(true);
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  const currentPage = navItems.find((n) => pathname.startsWith(n.href))?.label ?? "Admin";

  return (
    <div className={styles.shell}>
      {/* ── Sidebar (desktop) ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span className={styles.logoMark}>π</span>
          <div>
            <div className={styles.logoTitle}>Supapi</div>
            <div className={styles.logoBadge}>Admin Panel</div>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.navActive : ""}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {active && <span className={styles.navPip} />}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className={styles.signOutBtn}
        >
          <span>⎋</span>
          <span>{signingOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <div className={styles.main}>
        {/* Top bar (mobile header) */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.topbarMark}>π</span>
            <span className={styles.topbarPage}>{currentPage}</span>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className={styles.topbarSignOut}
          >
            ⎋
          </button>
        </header>

        <div className={styles.content}>{children}</div>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className={styles.bottomNav}>
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.bottomItem} ${active ? styles.bottomActive : ""}`}
            >
              <span className={styles.bottomIcon}>{item.icon}</span>
              <span className={styles.bottomLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
