"use client";

// components/layout/TopBar.tsx

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import LoginButton from "@/components/auth/LoginButton";
import styles from "./TopBar.module.css";

const navLinks = [
  { href: "/",            label: "🏠 Home"         },
  { href: "/dashboard",   label: "👤 Dashboard"     },
  { href: "/supamarket",      label: "🛍️ SupaMarket"    },
  { href: "/supaskil",        label: "💼 SupaSkil"      },
  { href: "/supaminds",       label: "🧠 SupaMinds"     },
  { href: "/supademy",     label: "📚 SupaDemy"      },
  { href: "/stay",        label: "🏡 SupaStay"      },
  { href: "/supanova",      label: "🎮 SupaNova"       },
  { href: "/newsfeed",    label: "📰 Newsfeed"      },
  { href: "/supafeeds", label: "📱 SupaFeeds"    },
  { href: "/wallet",      label: "💰 Wallet"        },
  { href: "/supachat",    label: "💬 SupaChat"      },
  { href: "/sc-p2p",      label: "💸 SC P2P"        },
  { href: "/referral",    label: "🤝 Referral"      },
  { href: "/locator",     label: "📍 Locator"       },
  { href: "/supahiro",        label: "🧑‍💻 SupaHiro"      },
  { href: "/rewards",     label: "🎁 Rewards"       },
  { href: "/reels",       label: "🎬 Reels"         },
  { href: "/live",        label: "🔴 Live"          },
  { href: "/pi-value",    label: "📈 Pi Value"      },
  { href: "/supasifieds", label: "📋 Supasifieds"   },
  { href: "/supaspace",     label: "🪐 SupaSpace"     },
  { href: "/pioneers",    label: "🌍 Pioneers"      },
  { href: "/supa-livvi",  label: "✨ SupaLivvi"     },
  { href: "/supa-saylo",  label: "🧵 SupaSaylo"     },
  { href: "/supabulk",          label: "📦 SupaBulk"        },
  { href: "/supaauto",  label: "🚗 SupaAuto"        },
  { href: "/domus",            label: "🏠 SupaDomus"       },
  { href: "/supaendoro",           label: "🛞 SupaEndoro"      },
];

export default function TopBar() {
  const pathname  = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!scrollRef.current || !activeRef.current) return;
    const container = scrollRef.current;
    const active    = activeRef.current;
    const scrollTo = active.offsetLeft - container.offsetWidth / 2 + active.offsetWidth / 2;
    container.scrollTo({ left: scrollTo, behavior: "smooth" });
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;

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
