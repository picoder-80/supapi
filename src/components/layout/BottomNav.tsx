"use client";

// components/layout/BottomNav.tsx

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

const navItems = [
  { href: "/",       emoji: "🏠", label: "Home"    },
  { href: "/market", emoji: "🛍️", label: "Market"  },
  { href: "/gigs",   emoji: "💼", label: "Gigs"    },
  { href: "/arcade", emoji: "🎮", label: "Arcade"  },
  { href: "/wallet", emoji: "💰", label: "Wallet"  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.item} ${isActive ? styles.active : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={styles.icon}>{item.emoji}</span>
            <span className={styles.label}>{item.label}</span>
            {isActive && <span className={styles.dot} aria-hidden="true" />}
          </Link>
        );
      })}
    </nav>
  );
}
