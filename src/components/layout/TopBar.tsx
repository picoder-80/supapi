"use client";

// components/layout/TopBar.tsx

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./TopBar.module.css";

const links = [
  { href: "/dashboard",   label: "👤 Dashboard"     },
  { href: "/market",      label: "🛍️ Market"         },
  { href: "/gigs",        label: "💼 Gigs"           },
  { href: "/academy",     label: "📚 Academy"        },
  { href: "/stay",        label: "🏡 Stay"           },
  { href: "/arcade",      label: "🎮 Arcade"         },
  { href: "/community",   label: "👥 Community"      },
  { href: "/wallet",      label: "💰 Wallet"         },
  { href: "/referral",    label: "🤝 Referral"       },
  { href: "/locator",     label: "📍 Locator"        },
  { href: "/jobs",        label: "🧑‍💻 Jobs"           },
  { href: "/rewards",     label: "🎁 Rewards"        },
  { href: "/content",     label: "🎬 Content"        },
  { href: "/pi-value",    label: "📈 Pi Value"       },
  { href: "/classifieds", label: "📋 Classifieds"    },
  { href: "/myspace",     label: "🪐 MySpace"        },
];

export default function TopBar() {
  const pathname = usePathname();
  const { user }  = useAuth();
  const navRef    = useRef<HTMLDivElement>(null);

  // Hide on admin pages
  if (pathname.startsWith("/admin")) return null;

  // Auto-scroll active item into view
  useEffect(() => {
    const active = navRef.current?.querySelector("[data-active='true']") as HTMLElement;
    active?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [pathname]);

  return (
    <header className={styles.topbar}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoMark}>π</span>
        <span className={styles.logoText}>Supapi</span>
      </Link>

      <nav className={styles.nav} ref={navRef}>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            data-active={pathname === l.href || pathname.startsWith(l.href + "/")}
            className={`${styles.link} ${(pathname === l.href || pathname.startsWith(l.href + "/")) ? styles.active : ""}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={styles.actions}>
        {user ? (
          <Link href="/dashboard" className={styles.userBtn}>
            π {user.username}
          </Link>
        ) : (
          <Link href="/" className={styles.signInBtn}>
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}