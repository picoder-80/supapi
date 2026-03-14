"use client";

// components/admin/AdminShell.tsx

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./AdminShell.module.css";
import { MOBILE_QUICK_NAV, SIDEBAR_ADMIN_NAV, SIDEBAR_PLATFORM_NAV } from "@/lib/admin/adminNavConfig";
import { canAccessAdminHref, canAccessAdminPath } from "@/lib/admin/nav-access";

const ADMIN_TOKEN_KEY = "supapi_admin_token";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [signingOut, setSigningOut]   = useState(false);
  const [authorized, setAuthorized]   = useState(false);
  const [checking,   setChecking]     = useState(true);
  const [adminRole, setAdminRole]     = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeHash, setActiveHash]   = useState("");
  const bottomNavRef = useRef<HTMLElement>(null);
  const mobileAdminToolsNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (pathname === "/admin/login") { setChecking(false); return; }
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setAuthorized(true);
    const hydrateRole = async () => {
      try {
        const res = await fetch("/api/admin/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (payload?.success) setAdminRole(String(payload?.data?.me?.role ?? ""));
      } finally {
        setChecking(false);
      }
    };
    hydrateRole();
  }, [pathname, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncHash = () => setActiveHash(window.location.hash.replace("#", "").trim());
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);
  useEffect(() => {
    const nav = bottomNavRef.current;
    if (!nav) return;
    const active = nav.querySelector("[data-active='true']") as HTMLElement | null;
    if (!active) return;
    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const left = nav.scrollLeft + (activeRect.left - navRect.left) - (navRect.width / 2) + (activeRect.width / 2);
    nav.scrollTo({ left, behavior: "smooth" });
  }, [pathname, activeHash]);
  useEffect(() => {
    const nav = mobileAdminToolsNavRef.current;
    if (!nav) return;
    const active = nav.querySelector("[data-active='true']") as HTMLElement | null;
    if (!active) return;
    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const left = nav.scrollLeft + (activeRect.left - navRect.left) - (navRect.width / 2) + (activeRect.width / 2);
    nav.scrollTo({ left, behavior: "smooth" });
  }, [pathname, activeHash]);

  useEffect(() => {
    if (!authorized || checking) return;
    if (!pathname.startsWith("/admin")) return;
    if (pathname === "/admin/login" || pathname === "/admin/forbidden") return;
    if (!canAccessAdminPath(adminRole, pathname)) {
      router.replace("/admin/forbidden");
    }
  }, [authorized, checking, pathname, adminRole, router]);

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

  const visibleSidebarAdminNav = SIDEBAR_ADMIN_NAV.filter((item) => canAccessAdminHref(adminRole, item.href));
  const visibleSidebarPlatformNav = SIDEBAR_PLATFORM_NAV.filter((item) => canAccessAdminHref(adminRole, item.href));
  const visibleMobileNav = MOBILE_QUICK_NAV.filter((item) => canAccessAdminHref(adminRole, item.href));
  const visibleMobileAdminToolsNav = visibleSidebarAdminNav;
  const allVisibleNav = [...visibleSidebarAdminNav, ...visibleSidebarPlatformNav, ...visibleMobileNav];

  const currentLabel = allVisibleNav.find((n) => {
    const [base, hash] = n.href.split("#");
    if (!pathname.startsWith(base)) return false;
    return hash ? activeHash === hash : true;
  })?.label ?? "Admin";

  const isActive = (href: string) => {
    const [base, hash] = href.split("#");
    if (!pathname.startsWith(base)) return false;
    return hash ? activeHash === hash : true;
  };

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
            {visibleSidebarAdminNav.map(item => (
              <Link key={item.href} href={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navActive : ""}`}>
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                <span className={`${styles.navBadge} ${item.status === "live" ? styles.navBadgeLive : styles.navBadgeSoon}`}>
                  {item.status}
                </span>
                {isActive(item.href) && <span className={styles.navPip} />}
              </Link>
            ))}
          </div>

          {/* Platform Administration */}
          <div className={styles.navGroup}>
            <div className={styles.navGroupLabel}>PLATFORM ADMINISTRATION</div>
            {visibleSidebarPlatformNav.map(item => (
              <Link key={item.href} href={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navActive : ""}`}>
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                <span className={`${styles.navBadge} ${item.status === "live" ? styles.navBadgeLive : styles.navBadgeSoon}`}>
                  {item.status}
                </span>
                {isActive(item.href) && <span className={styles.navPip} />}
              </Link>
            ))}
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

        {/* Mobile-only Admin Tools top menu */}
        <nav className={styles.mobileAdminToolsNav} ref={mobileAdminToolsNavRef}>
          {visibleMobileAdminToolsNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={isActive(item.href)}
              className={`${styles.mobileAdminToolItem} ${isActive(item.href) ? styles.mobileAdminToolActive : ""}`}
            >
              <span className={styles.mobileAdminToolIcon}>{item.icon}</span>
              <span className={styles.mobileAdminToolLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.content}>{children}</div>

        {/* Bottom nav — mobile quick access */}
        <nav className={styles.bottomNav} ref={bottomNavRef}>
          {visibleMobileNav.map(item => (
            <Link key={item.href} href={item.href}
              data-active={isActive(item.href)}
              className={`${styles.bottomItem} ${isActive(item.href) ? styles.bottomActive : ""}`}>
              <span className={styles.bottomIcon}>{item.icon}</span>
              <span className={styles.bottomLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}