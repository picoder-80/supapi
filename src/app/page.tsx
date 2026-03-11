"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

const modules = [
  { href: "/about",       emoji: "ℹ️",  label: "About Us",      desc: "Our story, mission & vision"      },
  { href: "/myspace",     emoji: "🪐",  label: "MySpace",       desc: "Your personal Pi profile"         },
  { href: "/market",      emoji: "🛍️",  label: "Marketplace",  desc: "Buy & sell items"                },
  { href: "/gigs",        emoji: "💼",  label: "Gigs",          desc: "Freelance services"               },
  { href: "/academy",     emoji: "📚",  label: "Academy",       desc: "Learn & teach"                    },
  { href: "/stay",        emoji: "🏠",  label: "Stay",          desc: "Rent accommodations"              },
  { href: "/arcade",      emoji: "🎮",  label: "Arcade",        desc: "Play & earn Pi"                   },
  { href: "/newsfeed",   emoji: "📰",  label: "Newsfeed",     desc: "Posts from pioneers you follow"               },
  { href: "/wallet",      emoji: "💰",  label: "Wallet",        desc: "Transactions & history"           },
  { href: "/referral",    emoji: "🤝",  label: "Referral",      desc: "Invite & earn Pi"                 },
  { href: "/locator",     emoji: "📍",  label: "Locator",       desc: "Find Pi-friendly businesses"      },
  { href: "/jobs",        emoji: "🧑‍💻",  label: "Jobs",          desc: "Hire & get hired"                 },
  { href: "/rewards",     emoji: "🎁",  label: "Daily Rewards", desc: "Check-in & earn Pi daily"         },
  { href: "/reels",     emoji: "🎬",  label: "Reels",       desc: "Short videos from pioneers"              },
  { href: "/pi-value",    emoji: "📈",  label: "Market Value",  desc: "Pi Live Market Data & Pi USD Converter"   },
  { href: "/classifieds", emoji: "📋",  label: "Classifieds",   desc: "Promote services & businesses"    },
  { href: "/pioneers",    emoji: "🌍",  label: "I Am a Pioneer", desc: "Pin yourself & find nearby Pioneers" },
  { href: "/supa-livvi",  emoji: "✨",  label: "SupaLivvi",      desc: "Pi Lifestyle & Discovery" },
];

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface FeedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  kyc_status: string;
  bio: string | null;
}

interface FeedData {
  following: FeedUser[];
  popular: FeedUser[];
  has_posts: boolean;
}

export default function HomePage() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [feedTab, setFeedTab] = useState<"following" | "popular">("following");

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const uid = user?.id ?? "";
        const r = await fetch(`/api/newsfeed${uid ? `?userId=${uid}` : ""}`);
        const d = await r.json();
        if (d.success) setFeed(d.data);
      } catch {}
    };
    fetchFeed();
  }, [user?.id]);

  const feedList = feedTab === "following" ? (feed?.following ?? []) : (feed?.popular ?? []);

  return (
    <main className={styles.main}>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>🚀 Pi Network — Going Mainstream</div>
        <h1 className={styles.heroTitle}>
          <span className={styles.heroGold}>π</span> Supapi
        </h1>
        <p className={styles.heroSub}>
          The Pi Network Super App. One platform for everything you need in the Pi ecosystem.
        </p>
        <div className={styles.heroActions}>
          <Link href="/market"   className={styles.btnPrimary}>Explore Now</Link>
          <Link href="/referral" className={styles.btnOutline}>Earn Pi ↗</Link>
        </div>
      </section>

      {/* Platforms */}
      <section className={styles.modules}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Our Platform</h2>
          <div className={styles.grid}>
            {modules.map((m) => (
              <Link key={m.href} href={m.href} className={styles.card}>
                <span className={styles.cardEmoji}>{m.emoji}</span>
                <strong className={styles.cardLabel}>{m.label}</strong>
                <span className={styles.cardDesc}>{m.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* One Identity Banner */}
      <section className={styles.identity}>
        <div className="container">
          <div className={styles.identityBox}>
            <div className={styles.identityIcon}>π</div>
            <div className={styles.identityText}>
              <h3 className={styles.identityTitle}>One Pi Identity. Every Role.</h3>
              <p className={styles.identityDesc}>
                Your Pi username is your passport across all Supapi platforms.
                Be a buyer, seller, student, tutor, host, tenant, freelancer and more —
                all with <strong>one account</strong>, <strong>one wallet</strong>, <strong>one reputation</strong>.
              </p>
              <div className={styles.identityRoles}>
                {["🛍️ Buyer","🏪 Seller","🎓 Student","👨‍🏫 Tutor","🏠 Host","🏡 Tenant","💼 Freelancer","🧑‍💻 Employer","🎬 Creator","🪐 Pioneer"].map((r) => (
                  <span key={r} className={styles.roleTag}>{r}</span>
                ))}
              </div>
            </div>
            <Link href="/market" className={styles.identityBtn}>Get Started →</Link>
          </div>
        </div>
      </section>

      {/* ── Newsfeed ── */}
      <section className={styles.newsfeed}>
        <div className="container">
          <div className={styles.feedHeader}>
            <div>
              <h2 className={styles.sectionTitle} style={{ marginBottom: 4 }}>Pioneer Newsfeed</h2>
              <p className={styles.feedSubtitle}>Posts from pioneers you follow & trending in the community</p>
            </div>
            <Link href="/newsfeed" className={styles.feedSeeAll}>See all →</Link>
          </div>

          {/* Tabs */}
          <div className={styles.feedTabs}>
            <button
              className={`${styles.feedTab} ${feedTab === "following" ? styles.feedTabActive : ""}`}
              onClick={() => setFeedTab("following")}
            >
              👥 Following
            </button>
            <button
              className={`${styles.feedTab} ${feedTab === "popular" ? styles.feedTabActive : ""}`}
              onClick={() => setFeedTab("popular")}
            >
              🔥 Popular
            </button>
          </div>

          {/* Feed content */}
          {feedTab === "following" && !user ? (
            <div className={styles.feedLoginPrompt}>
              <div className={styles.feedLoginIcon}>🪐</div>
              <div className={styles.feedLoginTitle}>Sign in to see your feed</div>
              <div className={styles.feedLoginSub}>Follow pioneers to see their posts here</div>
              <Link href="/dashboard" className={styles.feedLoginBtn}>Sign In with Pi</Link>
            </div>
          ) : feedTab === "following" && user && feedList.length === 0 ? (
            <div className={styles.feedEmpty}>
              <div className={styles.feedEmptyIcon}>👥</div>
              <div className={styles.feedEmptyTitle}>No one to show yet</div>
              <div className={styles.feedEmptyDesc}>
                Follow pioneers from their profile — their posts will appear here
              </div>
              <button
                className={styles.feedLoginBtn}
                onClick={() => setFeedTab("popular")}
              >
                Discover Popular Pioneers →
              </button>
            </div>
          ) : feedList.length > 0 ? (
            <div className={styles.feedGrid}>
              {feedList.map((p) => (
                <Link key={p.id} href={`/myspace/${p.username}`} className={styles.feedCard}>
                  <div className={styles.feedCardTop}>
                    <div className={styles.feedAvatar}>
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt={p.username} className={styles.feedAvatarImg} />
                        : <span className={styles.feedAvatarInitial}>{getInitial(p.username)}</span>
                      }
                    </div>
                    <div className={styles.feedUserInfo}>
                      <div className={styles.feedDisplayName}>
                        {p.display_name ?? p.username}
                        {p.kyc_status === "verified" && <span className={styles.feedKyc}>✅</span>}
                      </div>
                      <div className={styles.feedUsername}>@{p.username}</div>
                    </div>
                  </div>
                  {p.bio && (
                    <div className={styles.feedBio}>{p.bio}</div>
                  )}
                  <div className={styles.feedCardFooter}>
                    <span className={styles.feedPioneerTag}>🪐 Pioneer</span>
                    <span className={styles.feedViewProfile}>View Profile →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.feedEmpty}>
              <div className={styles.feedEmptyIcon}>📰</div>
              <div className={styles.feedEmptyTitle}>Loading feed...</div>
            </div>
          )}

          {/* Coming soon note */}
          <div className={styles.feedComingSoon}>
            📝 Full post & reel feed coming soon — for now, explore pioneer profiles
          </div>
        </div>
      </section>

    </main>
  );
}