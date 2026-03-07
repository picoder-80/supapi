"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./BottomNav.module.css";

const SCROLL_ITEMS = [
  { href: "/",           emoji: "🏠",  label: "Home"       },
  { href: "/market",     emoji: "🛍️",  label: "Market"     },
  { href: "/gigs",       emoji: "💼",  label: "Gigs"       },
  { href: "/academy",    emoji: "📚",  label: "Academy"    },
  { href: "/stay",       emoji: "🏡",  label: "Stay"       },
  { href: "/arcade",     emoji: "🎮",  label: "Arcade"     },
  { href: "/community",  emoji: "👥",  label: "Community"  },
  { href: "/wallet",     emoji: "💰",  label: "Wallet"     },
  { href: "/referral",   emoji: "🤝",  label: "Referral"   },
  { href: "/locator",    emoji: "📍",  label: "Locator"    },
  { href: "/jobs",       emoji: "🧑‍💻",  label: "Jobs"       },
  { href: "/rewards",    emoji: "🎁",  label: "Rewards"    },
  { href: "/content",    emoji: "🎬",  label: "Content"    },
  { href: "/pi-value",   emoji: "📈",  label: "Pi Value"   },
  { href: "/classifieds",emoji: "📋",  label: "Classifieds"},
  { href: "/myspace",    emoji: "🪐",  label: "MySpace"    },
];

export default function BottomNav() {
  const pathname  = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const active = scrollRef.current?.querySelector("[data-active='true']") as HTMLElement;
    active?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;

  const isDashboard = pathname === "/dashboard";

  return (
    <nav className={styles.nav}>
      {/* Fixed Dashboard button */}
      <Link
        href="/dashboard"
        className={`${styles.fixed} ${isDashboard ? styles.active : ""}`}
      >
        <span className={styles.emoji}>👤</span>
        <span className={styles.label}>Dashboard</span>
      </Link>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Scrollable rest */}
      <div className={styles.scroll} ref={scrollRef}>
        {SCROLL_ITEMS.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={isActive}
              className={`${styles.item} ${isActive ? styles.active : ""}`}
            >
              <span className={styles.emoji}>{item.emoji}</span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}