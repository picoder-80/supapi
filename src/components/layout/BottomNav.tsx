"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./BottomNav.module.css";

const SCROLL_ITEMS = [
  { href: "/",            emoji: "🏠",  label: "Home"       },
  { href: "/market",      emoji: "🛍️",  label: "Market"     },
  { href: "/gigs",        emoji: "💼",  label: "Gigs"       },
  { href: "/academy",     emoji: "📚",  label: "Academy"    },
  { href: "/stay",        emoji: "🏡",  label: "Stay"       },
  { href: "/arcade",      emoji: "🎮",  label: "Arcade"     },
  { href: "/newsfeed",    emoji: "📰",  label: "Newsfeed"   },
  { href: "/wallet",      emoji: "💰",  label: "Wallet"     },
  { href: "/referral",    emoji: "🤝",  label: "Referral"   },
  { href: "/locator",     emoji: "📍",  label: "Locator"    },
  { href: "/jobs",        emoji: "🧑‍💻",  label: "Jobs"       },
  { href: "/rewards",     emoji: "🎁",  label: "Rewards"    },
  { href: "/reels",       emoji: "🎬",  label: "Reels"      },
  { href: "/pi-value",    emoji: "📈",  label: "Pi Value"   },
  { href: "/classifieds", emoji: "📋",  label: "Classifieds"},
  { href: "/myspace",     emoji: "🪐",  label: "MySpace"    },
  { href: "/pioneers",    emoji: "🌍",  label: "Pioneers"   },
  { href: "/supa-livvi",  emoji: "✨",  label: "SupaLivvi"  },
  { href: "/supa-saylo",  emoji: "🧵",  label: "SupaSaylo"  },
  { href: "/bulkhub",         emoji: "📦",  label: "BulkHub"       },
  { href: "/machina-market", emoji: "🚗",  label: "MachinaMarket" },
];

export default function BottomNav() {
  const pathname  = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const container = scrollRef.current;
    if (!container) return;
    const active = container.querySelector("[data-active='true']") as HTMLElement | null;
    if (!active) return;
    const containerRect = container.getBoundingClientRect();
    const activeRect    = active.getBoundingClientRect();
    const scrollTo = container.scrollLeft
      + (activeRect.left - containerRect.left)
      - (containerRect.width / 2)
      + (activeRect.width / 2);
    container.scrollTo({ left: scrollTo, behavior: "instant" });
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;

  const isDashboard = pathname === "/dashboard";

  return (
    <nav className={styles.nav}>
      <Link
        href="/dashboard"
        className={`${styles.fixed} ${isDashboard ? styles.active : ""}`}
      >
        <span className={styles.emoji}>👤</span>
        <span className={styles.label}>Dashboard</span>
      </Link>

      <div className={styles.divider} />

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
