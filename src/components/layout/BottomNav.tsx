"use client";

// components/layout/BottomNav.tsx

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./BottomNav.module.css";

const items = [
  { href: "/dashboard", emoji: "👤",  label: "Dashboard" },
  { href: "/market",    emoji: "🛍️",  label: "Market"    },
  { href: "/gigs",      emoji: "💼",  label: "Gigs"      },
  { href: "/academy",   emoji: "📚",  label: "Academy"   },
  { href: "/stay",      emoji: "🏡",  label: "Stay"      },
  { href: "/arcade",    emoji: "🎮",  label: "Arcade"    },
  { href: "/community", emoji: "👥",  label: "Community" },
  { href: "/wallet",    emoji: "💰",  label: "Wallet"    },
  { href: "/referral",  emoji: "🤝",  label: "Referral"  },
  { href: "/locator",   emoji: "📍",  label: "Locator"   },
  { href: "/jobs",      emoji: "🧑‍💻",  label: "Jobs"      },
  { href: "/rewards",   emoji: "🎁",  label: "Rewards"   },
  { href: "/content",   emoji: "🎬",  label: "Content"   },
  { href: "/pi-value",  emoji: "📈",  label: "Pi Value"  },
  { href: "/classifieds",emoji: "📋", label: "Classifieds"},
  { href: "/myspace",   emoji: "🪐",  label: "MySpace"   },
];

export default function BottomNav() {
  const pathname = usePathname();
  const navRef   = useRef<HTMLDivElement>(null);

  // Hide on admin pages
  if (pathname.startsWith("/admin")) return null;

  // Auto-scroll active item
  useEffect(() => {
    const active = navRef.current?.querySelector("[data-active='true']") as HTMLElement;
    active?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [pathname]);

  return (
    <nav className={styles.bottomNav} ref={navRef}>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
    </nav>
  );
}