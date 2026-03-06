"use client";

// components/layout/TopBar.tsx

import Link from "next/link";
import LoginButton from "@/components/auth/LoginButton";
import styles from "./TopBar.module.css";

const desktopLinks = [
  { href: "/market",    label: "🛍️ Market"    },
  { href: "/gigs",      label: "💼 Gigs"      },
  { href: "/academy",   label: "📚 Academy"   },
  { href: "/stay",      label: "🏠 Stay"      },
  { href: "/arcade",    label: "🎮 Arcade"    },
  { href: "/community", label: "👥 Community" },
];

export default function TopBar() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoSymbol}>π</span>
          <span className={styles.logoText}>Supapi</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Desktop navigation">
          {desktopLinks.map((l) => (
            <Link key={l.href} href={l.href} className={styles.navLink}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <LoginButton />
        </div>
      </div>
    </header>
  );
}
