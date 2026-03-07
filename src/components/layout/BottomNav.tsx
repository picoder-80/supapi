"use client";

// components/layout/BottomNav.tsx

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./BottomNav.module.css";

const navItems = [
  { href: "/",          emoji: "🏠",  label: "Home"       },
  { href: "/market",    emoji: "🛍️",  label: "Market"     },
  { href: "/gigs",      emoji: "💼",  label: "Gigs"       },
  { href: "/academy",   emoji: "📚",  label: "Academy"    },
  { href: "/stay",      emoji: "🏡",  label: "Stay"       },
  { href: "/arcade",    emoji: "🎮",  label: "Arcade"     },
  { href: "/community", emoji: "👥",  label: "Community"  },
  { href: "/locator",   emoji: "📍",  label: "Locator"    },
  { href: "/jobs",      emoji: "🧑‍💻",  label: "Jobs"       },
  { href: "/rewards",   emoji: "🎁",  label: "Rewards"    },
  { href: "/content",   emoji: "🎬",  label: "Content"    },
  { href: "/pi-value",  emoji: "📈",  label: "Pi Value"   },
  { href: "/wallet",    emoji: "💰",  label: "Wallet"     },
  { href: "/referral",  emoji: "🤝",  label: "Referral"   },
  { href: "/classifieds", emoji: "📋",  label: "Classifieds" },
  { href: "/myspace",   emoji: "🪐",  label: "MySpace"    },
];

export default function BottomNav() {
  const pathname  = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // ✅ Auto-scroll to active item when route changes
  useEffect(() => {
    if (!scrollRef.current || !activeRef.current) return;

    const container = scrollRef.current;
    const active    = activeRef.current;

    const containerWidth = container.offsetWidth;
    const itemLeft       = active.offsetLeft;
    const itemWidth      = active.offsetWidth;

    // Center the active item in the scroll container
    const scrollTo = itemLeft - containerWidth / 2 + itemWidth / 2;

    container.scrollTo({ left: scrollTo, behavior: "smooth" });
  }, [pathname]);

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      <div className={styles.scroll} ref={scrollRef}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              ref={isActive ? activeRef : undefined}
              className={`${styles.item} ${isActive ? styles.active : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={styles.icon}>{item.emoji}</span>
              <span className={styles.label}>{item.label}</span>
              {isActive && <span className={styles.dot} aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}