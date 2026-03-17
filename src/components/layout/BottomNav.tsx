"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./BottomNav.module.css";
import { getSupaChatBrowserClient } from "@/lib/supachat/client";

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
  { href: "/supachat",    emoji: "💬",  label: "Chat"       },
  { href: "/sc-p2p",      emoji: "💸",  label: "SC P2P"     },
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
  const [chatUnread, setChatUnread] = useState(0);
  const token = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : ""),
    []
  );
  const supabase = useMemo(() => getSupaChatBrowserClient(), []);

  const userId = useMemo(() => {
    if (!token) return "";
    const part = token.split(".")[1];
    if (!part) return "";
    try {
      const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      return String(payload.sub || payload.user_id || payload.id || "");
    } catch {
      return "";
    }
  }, [token]);

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

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadUnread = async () => {
      try {
        const r = await fetch("/api/supachat/conversations?unread=1", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (!active || !d?.success) return;
        const total = (d.data ?? []).reduce((sum: number, c: any) => sum + Number(c.unread_count || 0), 0);
        setChatUnread(total);
      } catch {}
    };
    loadUnread();
    if (!userId) return () => void 0;

    const channel = supabase
      .channel(`supachat-unread-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supachat_conversations",
          filter: `participant_1=eq.${userId}`,
        },
        () => {
          loadUnread();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supachat_conversations",
          filter: `participant_2=eq.${userId}`,
        },
        () => {
          loadUnread();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [token, userId, supabase]);

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
              <span className={styles.emojiWrap}>
                <span className={styles.emoji}>{item.emoji}</span>
                {item.href === "/supachat" && chatUnread > 0 && (
                  <span className={styles.unreadBadge}>{chatUnread > 99 ? "99+" : chatUnread}</span>
                )}
              </span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
