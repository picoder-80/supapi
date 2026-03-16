"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

type ModuleItem = { href: string; emoji: string; label: string; desc: string };

const platformCategories: { id: string; title: string; modules: ModuleItem[] }[] = [
  {
    id: "buy-sell",
    title: "Buy & Sell",
    modules: [
      { href: "/supamarket",        emoji: "🛍️", label: "SupaMarket",   desc: "Buy & sell items" },
      { href: "/supaskil",          emoji: "💼", label: "SupaSkil",     desc: "Freelance services" },
      { href: "/supabulk",       emoji: "📦", label: "SupaBulk",      desc: "Pi B2B Wholesale Marketplace" },
      { href: "/supaauto", emoji: "🚗", label: "SupaAuto",      desc: "Pi Automotive Marketplace" },
      { href: "/supadomus",         emoji: "🏠", label: "SupaDomus",     desc: "Pi Property Marketplace" },
      { href: "/supasifieds",   emoji: "📋", label: "Supasifieds",   desc: "Promote services & businesses" },
      { href: "/supascrow",     emoji: "🛡️", label: "SupaScrow",     desc: "Secure Pi escrow for safe trading" },
    ],
  },
  {
    id: "social",
    title: "Social & Feed",
    modules: [
      { href: "/social-feeds", emoji: "📱", label: "SupaFeeds",    desc: "Post, Reels & Live in one combined feed" },
      { href: "/newsfeed",     emoji: "📰", label: "Newsfeed",     desc: "Status updates from pioneers you follow" },
      { href: "/reels",        emoji: "🎬", label: "Reels",        desc: "Short videos from pioneers" },
      { href: "/live",         emoji: "🔴", label: "Live",         desc: "Live streams from pioneers you follow" },
      { href: "/supa-livvi",   emoji: "✨", label: "SupaLivvi",   desc: "Pi Lifestyle & Discovery" },
      { href: "/supa-saylo",   emoji: "🧵", label: "SupaSaylo",   desc: "Pi Conversations & Threads" },
      { href: "/supaspace",      emoji: "🪐", label: "SupaSpace",    desc: "Your personal Pi profile" },
    ],
  },
  {
    id: "learn-play",
    title: "Learn & Play",
    modules: [
      { href: "/supademy",  emoji: "📚", label: "SupaDemy",      desc: "Learn & teach" },
      { href: "/supanova",   emoji: "🎮", label: "SupaNova",       desc: "Play & earn Pi" },
      { href: "/rewards",  emoji: "🎁", label: "Daily Rewards", desc: "Check-in & earn Pi daily" },
      { href: "/referral", emoji: "🤝", label: "Referral",       desc: "Invite & earn Pi" },
      { href: "/supapets", emoji: "🐾", label: "SupaPets",      desc: "Virtual pets, daily care, SC rewards" },
    ],
  },
  {
    id: "stay-go",
    title: "Stay & Go",
    modules: [
      { href: "/supastay",     emoji: "🏠", label: "SupaStay",      desc: "Rent accommodations" },
      { href: "/supaendoro",   emoji: "🛞", label: "SupaEndoro",    desc: "Pi Peer-to-Peer Vehicle Rental" },
      { href: "/locator",  emoji: "📍", label: "Locator",       desc: "Find Pi-friendly businesses" },
      { href: "/pioneers", emoji: "🌍", label: "I Am a Pioneer", desc: "Pin yourself & find nearby Pioneers" },
    ],
  },
  {
    id: "work",
    title: "Work",
    modules: [
      { href: "/supahiro", emoji: "🧑‍💻", label: "SupaHiro", desc: "Hire & get hired" },
    ],
  },
  {
    id: "wallet-tools",
    title: "Wallet & Tools",
    modules: [
      { href: "/wallet",   emoji: "💰", label: "Wallet",       desc: "Transactions & history" },
      { href: "/pi-value", emoji: "📈", label: "Market Value", desc: "Pi Live Market Data & Pi USD Converter" },
      { href: "/about",    emoji: "ℹ️", label: "About Us",     desc: "Our story, mission & vision" },
    ],
  },
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
          <Link href="/supamarket"   className={styles.btnPrimary}>Explore Now</Link>
          <Link href="/referral" className={styles.btnOutline}>Earn Pi ↗</Link>
        </div>
      </section>

      {/* About Us teaser */}
      <section className={styles.aboutTeaser}>
        <div className={styles.aboutTeaserWrap}>
          <div className={styles.aboutTeaserAccent} />
          <div className={styles.aboutTeaserInner}>
            <span className={styles.aboutTeaserLabel}>WHO WE ARE</span>
            <h2 className={styles.aboutTeaserTitle}>More Than an App.<br />We Are Infrastructure.</h2>
            <div className={styles.aboutTeaserBody}>
              <p>
                Supapi is a comprehensive, community-driven super app built exclusively for the Pi Network ecosystem. From the moment Pi Browser opens, Supapi puts the full power of Pi utility directly into the hands of every Pioneer — whether you are a seasoned miner, a small business owner, a freelancer, a student, or simply someone who believes in the promise of decentralised finance.
              </p>
              <p>
                We are not just another app. We are the bridge between Pi coins sitting in wallets and real-world value being created, exchanged, and multiplied — every single day. We exist to answer one question that millions of Pioneers have asked since Day 1: <em className={styles.aboutQuote}>&ldquo;When can I actually use my Pi?&rdquo;</em> The answer is now. The answer is Supapi.
              </p>
            </div>
            <Link href="/about" className={styles.aboutTeaserBtn}>
              <span>Read more</span>
              <span className={styles.aboutTeaserBtnArrow}>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Platforms by category */}
      {platformCategories.map((cat) => (
        <section key={cat.id} className={styles.modules}>
          <div className="container">
            <h2 className={styles.sectionTitle}>{cat.title}</h2>
            <div className={styles.grid}>
              {cat.modules.map((m) => (
                <Link key={m.href} href={m.href} className={styles.card}>
                  <span className={styles.cardEmoji}>{m.emoji}</span>
                  <strong className={styles.cardLabel}>{m.label}</strong>
                  <span className={styles.cardDesc}>{m.desc}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

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
            <Link href="/supamarket" className={styles.identityBtn}>Get Started →</Link>
          </div>
        </div>
      </section>

      {/* ── SupaFeeds / Pioneer Discovery ── */}
      <section className={styles.newsfeed}>
        <div className="container">
          <div className={styles.feedHeader}>
            <div>
              <h2 className={styles.sectionTitle} style={{ marginBottom: 4 }}>SupaFeeds</h2>
              <p className={styles.feedSubtitle}>Pioneers you follow & popular in the community</p>
            </div>
            <Link href="/supafeeds" className={styles.feedSeeAll}>See all →</Link>
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
                <Link key={p.id} href={`/supaspace/${p.username}`} className={styles.feedCard}>
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