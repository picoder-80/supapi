"use client";

// components/layout/TopBar.tsx

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import LoginButton from "@/components/auth/LoginButton";
import styles from "./TopBar.module.css";

const navLinks = [
  { href: "/market",    label: "🛍️ Market"       },
  { href: "/gigs",      label: "💼 Gigs"          },
  { href: "/academy",   label: "📚 Academy"       },
  { href: "/stay",      label: "🏡 Stay"          },
  { href: "/arcade",    label: "🎮 Arcade"        },
  { href: "/community", label: "👥 Community"     },
  { href: "/locator",   label: "📍 Locator"       },
  { href: "/jobs",      label: "🧑‍💻 Jobs"          },
  { href: "/rewards",   label: "🎁 Rewards"       },
  { href: "/content",   label: "🎬 Content"       },
  { href: "/pi-value",  label: "📈 Market Value"  },
  { href: "/wallet",    label: "💰 Wallet"        },
  { href: "/referral",  label: "🤝 Referral"      },
  { href: "/ads",       label: "📣 Ads"           },
];

export default function TopBar() {
  const pathname  = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // ✅ Auto-scroll to active nav item on route change
  useEffect(() => {
    if (!scrollRef.current || !activeRef.current) return;

    const container = scrollRef.current;
    const active    = activeRef.current;

    const scrollTo = active.offsetLeft - container.offsetWidth / 2 + active.offsetWidth / 2;
    container.scrollTo({ left: scrollTo, behavior: "smooth" });
  }, [pathname]);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoSymbol}>π</span>
          <span className={styles.logoText}>Supapi</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Desktop navigation">
          <div className={styles.navScroll} ref={scrollRef}>
            {navLinks.map((l) => {
              const isActive = pathname === l.href ||
                (l.href !== "/" && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  ref={isActive ? activeRef : undefined}
                  className={`${styles.navLink} ${isActive ? styles.navActive : ""}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className={styles.actions}>
          <LoginButton />
        </div>
      </div>
    </header>
  );
}