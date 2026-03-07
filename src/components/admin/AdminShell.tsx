"use client";

// components/admin/AdminShell.tsx

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./AdminShell.module.css";

const ADMIN_TOKEN_KEY = "supapi_admin_token";

const ADMIN_NAV = [
  { href: "/admin/dashboard",  icon: "▦",  label: "Dashboard"   },
  { href: "/admin/users",      icon: "👥", label: "Users"        },
  { href: "/admin/listings",   icon: "🛍️", label: "Listings"     },
  { href: "/admin/orders",     icon: "📦", label: "Orders"       },
  { href: "/admin/analytics",  icon: "📊", label: "Analytics"    },
];

const PLATFORMS_NAV = [
  { href: "/market",      icon: "🛍️", label: "Marketplace"  },
  { href: "/gigs",        icon: "💼", label: "Gigs"          },
  { href: "/academy",     icon: "📚", label: "Academy"       },
  { href: "/stay",        icon: "🏡", label: "Stay"          },
  { href: "/arcade",      icon: "🎮", label: "Arcade"        },
  { href: "/community",   icon: "👥", label: "Community"     },
  { href: "/wallet",      icon: "💰", label: "Wallet"        },
  { href: "/referral",    icon: "🤝", label: "Referral"      },
  { href: "/locator",     icon: "📍", label: "Locator"       },
  { href: "/jobs",        icon: "🧑‍💻", label: "Jobs"          },
  { href: "/rewards",     icon: "🎁", label: "Rewards"       },
  { href: "/content",     icon: "🎬", label: "Content"       },
  { href: "/pi-value",    icon: "📈", label: "Pi Value"      },
  { href: "/classifieds", icon: "📋", label: "Classifieds"   },
  { href: "/myspace",     icon: "🪐", label: "MySpace"       },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname();
  const router      = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [checking,   setChecking]   = useState(true);

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

  if (pathname === "/admin/login") return <>{children}</>;

  if (checking) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
      <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Loading...</span>
    </div>
  );

  if (!authorized) return null;

  const currentLabel = [...ADMIN_NAV, ...PLATFORMS_NAV].find(n => pathname.startsWith(n.href))?.label ?? "Admin";

  return (
    <div className={styles.shell}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span className={styles.logoMark}>π</span>
          <div>
            <div className={styles.logoTitle}>Supapi</div>
            <span className={styles.logoBadge}>ADMIN</span>
          </div>
        </div>

        {/* Scrollable nav area */}
        <div className={styles.sidebarScroll}>
          {/* Admin Tools */}
          <div className={styles.navGroup}>
            <div className={styles.navGroupLabel}>ADMIN TOOLS</div>
            {ADMIN_NAV.map((item) => (
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
          </div>

          {/* Platforms */}
          <div className={styles.navGroup}>
            <div className={styles.navGroupLabel}>15 PLATFORMS</div>
            {PLATFORMS_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${pathname === item.href ? styles.navActive : ""}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* User Dashboard */}
          <div className={styles.navGroup}>
            <Link href="/dashboard" className={styles.navItem}>
              <span className={styles.navIcon}>🪐</span>
              <span className={styles.navLabel}>My Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Sign out — always at bottom */}
        <button onClick={handleSignOut} disabled={signingOut} className={styles.signOutBtn}>
          <span>🚪</span>
          <span>{signingOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.topbarMark}>π</span>
            <span className={styles.topbarPage}>{currentLabel}</span>
          </div>
          <button onClick={handleSignOut} className={styles.topbarSignOut}>🚪</button>
        </div>

        <div className={styles.content}>{children}</div>

        <nav className={styles.bottomNav}>
          {ADMIN_NAV.map((item) => (
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