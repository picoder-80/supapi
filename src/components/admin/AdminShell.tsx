"use client";

// components/admin/AdminShell.tsx

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./AdminShell.module.css";

const ADMIN_TOKEN_KEY = "supapi_admin_token";

const ADMIN_NAV = [
  { href: "/admin/dashboard", icon: "▦",  label: "Dashboard" },
  { href: "/admin/users",     icon: "👥", label: "Users"     },
];

const PLATFORMS_NAV = [
  { href: "/admin/platforms/marketplace", icon: "🛍️", label: "Marketplace"   },
  { href: "/admin/platforms/gigs",        icon: "💼", label: "Gigs"          },
  { href: "/admin/platforms/academy",     icon: "📚", label: "Academy"       },
  { href: "/admin/platforms/stay",        icon: "🏡", label: "Stay"          },
  { href: "/admin/platforms/arcade",      icon: "🎮", label: "Arcade"        },
  { href: "/admin/platforms/newsfeed",    icon: "📰", label: "Newsfeed"      },
  { href: "/admin/platforms/wallet",      icon: "💰", label: "Wallet"        },
  { href: "/admin/platforms/referral",    icon: "🤝", label: "Referral"      },
  { href: "/admin/platforms/locator",     icon: "📍", label: "Locator"       },
  { href: "/admin/platforms/jobs",        icon: "🧑‍💻", label: "Jobs"          },
  { href: "/admin/platforms/rewards",     icon: "🎁", label: "Rewards"       },
  { href: "/admin/platforms/reels",       icon: "🎬", label: "Reels"         },
  { href: "/admin/platforms/pi-value",    icon: "📈", label: "Pi Value"      },
  { href: "/admin/platforms/classifieds", icon: "📋", label: "Classifieds"   },
  { href: "/admin/platforms/myspace",     icon: "🪐", label: "MySpace"       },
];

const ALL_NAV = [...ADMIN_NAV, ...PLATFORMS_NAV];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [signingOut, setSigningOut]   = useState(false);
  const [authorized, setAuthorized]   = useState(false);
  const [checking,   setChecking]     = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") { setChecking(false); return; }
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) { router.replace("/admin/login"); }
    else { setAuthorized(true); setChecking(false); }
  }, [pathname, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const handleSignOut = async () => {
    setSigningOut(true);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    await fetch("/api/admin/auth", { method: "DELETE" });
    window.location.replace("/admin/login");
  };

  if (pathname === "/admin/login") return <>{children}</>;

  if (checking) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--color-bg)" }}>
      <span style={{ color:"var(--color-text-muted)", fontSize:14 }}>Loading...</span>
    </div>
  );

  if (!authorized) return null;

  const currentLabel = ALL_NAV.find(n => pathname.startsWith(n.href))?.label ?? "Admin";

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className={styles.shell}>

      {/* Overlay (mobile) */}
      {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarLogo}>
          <span className={styles.logoMark}>π</span>
          <div>
            <div className={styles.logoTitle}>Supapi</div>
            <span className={styles.logoBadge}>ADMIN</span>
          </div>
        </div>

        <div className={styles.sidebarScroll}>
          {/* Admin Tools */}
          <div className={styles.navGroup}>
            <div className={styles.navGroupLabel}>ADMIN TOOLS</div>
            {ADMIN_NAV.map(item => (
              <Link key={item.href} href={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navActive : ""}`}>
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {isActive(item.href) && <span className={styles.navPip} />}
              </Link>
            ))}
          </div>

          {/* Platform Administration */}
          <div className={styles.navGroup}>
            <div className={styles.navGroupLabel}>PLATFORM ADMINISTRATION</div>
            {PLATFORMS_NAV.map(item => (
              <Link key={item.href} href={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navActive : ""}`}>
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {isActive(item.href) && <span className={styles.navPip} />}
              </Link>
            ))}
          </div>

          {/* My Dashboard */}
          <div className={styles.navGroup}>
            <Link href="/dashboard" className={styles.navItem}>
              <span className={styles.navIcon}>🪐</span>
              <span className={styles.navLabel}>My Dashboard</span>
            </Link>
          </div>
        </div>

        <button onClick={handleSignOut} disabled={signingOut} className={styles.signOutBtn}>
          <span>🚪</span>
          <span>{signingOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.menuBtn} onClick={() => setSidebarOpen(v => !v)}>☰</button>
            <span className={styles.topbarMark}>π</span>
            <span className={styles.topbarPage}>{currentLabel}</span>
          </div>
          <button onClick={handleSignOut} className={styles.topbarSignOut}>🚪</button>
        </div>

        <div className={styles.content}>{children}</div>

        {/* Bottom nav — Admin Tools only */}
        <nav className={styles.bottomNav}>
          {ADMIN_NAV.map(item => (
            <Link key={item.href} href={item.href}
              className={`${styles.bottomItem} ${isActive(item.href) ? styles.bottomActive : ""}`}>
              <span className={styles.bottomIcon}>{item.icon}</span>
              <span className={styles.bottomLabel}>{item.label}</span>
            </Link>
          ))}
          {/* Show active platform in bottom nav if inside platform */}
          {PLATFORMS_NAV.filter(p => isActive(p.href)).map(item => (
            <Link key={item.href} href={item.href} className={`${styles.bottomItem} ${styles.bottomActive}`}>
              <span className={styles.bottomIcon}>{item.icon}</span>
              <span className={styles.bottomLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}