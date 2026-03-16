"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./BottomNav.module.css";

const SCROLL_ITEMS = [
  { href: "/",            emoji: "🏠",  label: "Home"       },
  { href: "/supamarket",      emoji: "🛍️",  label: "SupaMarket" },
  { href: "/supaskil",        emoji: "💼",  label: "SupaSkil"   },
  { href: "/supademy",     emoji: "📚",  label: "SupaDemy"   },
  { href: "/supastay",        emoji: "🏡",  label: "SupaStay"   },
  { href: "/arcade",      emoji: "🎮",  label: "SupaNova"   },
  { href: "/newsfeed",    emoji: "📰",  label: "Newsfeed"   },
  { href: "/supafeeds", emoji: "📱",  label: "SupaFeeds"  },
  { href: "/wallet",      emoji: "💰",  label: "Wallet"     },
  { href: "/referral",    emoji: "🤝",  label: "Referral"   },
  { href: "/locator",     emoji: "📍",  label: "Locator"    },
  { href: "/supahiro",        emoji: "🧑‍💻",  label: "SupaHiro"  },
  { href: "/rewards",     emoji: "🎁",  label: "Rewards"    },
  { href: "/reels",       emoji: "🎬",  label: "Reels"      },
  { href: "/live",        emoji: "🔴",  label: "Live"       },
  { href: "/pi-value",    emoji: "📈",  label: "Pi Value"   },
  { href: "/supasifieds", emoji: "📋",  label: "Supasifieds"},
  { href: "/supaspace",     emoji: "🪐",  label: "SupaSpace"  },
  { href: "/pioneers",    emoji: "🌍",  label: "Pioneers"   },
  { href: "/supa-livvi",  emoji: "✨",  label: "SupaLivvi"  },
  { href: "/supa-saylo",  emoji: "🧵",  label: "SupaSaylo"  },
  { href: "/supabulk",         emoji: "📦",  label: "SupaBulk"      },
  { href: "/supaauto", emoji: "🚗",  label: "SupaAuto"       },
  { href: "/domus",          emoji: "🏠",  label: "SupaDomus"      },
  { href: "/supaendoro",         emoji: "🛞",  label: "SupaEndoro"     },
  { href: "/supapets",       emoji: "🐾",  label: "SupaPets"      },
  { href: "/supascrow",      emoji: "🛡️",  label: "SupaScrow"     },
  { href: "/supapod",        emoji: "🎙️",  label: "SupaPod"       },
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
