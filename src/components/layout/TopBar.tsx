"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./TopBar.module.css";

const links = [
  { href: "/",            label: "🏠 Home"         },
  { href: "/dashboard",   label: "👤 Dashboard"     },
  { href: "/market",      label: "🛍️ Market"        },
  { href: "/gigs",        label: "💼 Gigs"          },
  { href: "/academy",     label: "📚 Academy"       },
  { href: "/stay",        label: "🏡 Stay"          },
  { href: "/arcade",      label: "🎮 Arcade"        },
  { href: "/newsfeed",    label: "📰 Newsfeed"      },
  { href: "/wallet",      label: "💰 Wallet"        },
  { href: "/referral",    label: "🤝 Referral"      },
  { href: "/locator",     label: "📍 Locator"       },
  { href: "/jobs",        label: "🧑‍💻 Jobs"          },
  { href: "/rewards",     label: "🎁 Rewards"       },
  { href: "/reels",       label: "🎬 Reels"         },
  { href: "/pi-value",    label: "📈 Pi Value"      },
  { href: "/classifieds", label: "📋 Classifieds"   },
  { href: "/myspace",     label: "🪐 MySpace"       },
];

function scrollActiveIntoView(container: HTMLDivElement | null) {
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
}

export default function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const navRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    scrollActiveIntoView(navRef.current);
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoSymbol}>π</span>
          <span className={styles.logoText}>Supapi</span>
        </Link>

        <div className={styles.desktopNav}>
          <div className={styles.navScroll} ref={navRef}>
            {links.map((l) => {
              const isActive = l.href === "/"
                ? pathname === "/"
                : pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  data-active={isActive}
                  className={`${styles.navLink} ${isActive ? styles.navActive : ""}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>

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
      </div>
    </header>
  );
}