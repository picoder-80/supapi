"use client";

import Link from "next/link";
import styles from "./page.module.css";

type PlatformItem = { href: string; emoji: string; label: string; desc: string };

const platformCategories: { title: string; platforms: PlatformItem[] }[] = [
  {
    title: "Buy & Sell",
    platforms: [
      { href: "/supamarket",        emoji: "🛍️", label: "SupaMarket",   desc: "Buy & sell with Pi" },
      { href: "/supaskil",          emoji: "💼", label: "SupaSkil",     desc: "Freelance in Pi" },
      { href: "/supabulk",       emoji: "📦", label: "SupaBulk",     desc: "B2B wholesale" },
      { href: "/supaauto", emoji: "🚗", label: "SupaAuto",    desc: "Automotive marketplace" },
      { href: "/supadomus",         emoji: "🏠", label: "SupaDomus",   desc: "Property marketplace" },
      { href: "/classifieds",   emoji: "📋", label: "Supasifieds",  desc: "Promote services" },
      { href: "/supascrow",     emoji: "🛡️", label: "SupaScrow",   desc: "Secure Pi escrow" },
    ],
  },
  {
    title: "Social & Feed",
    platforms: [
      { href: "/social-feeds", emoji: "📱", label: "SupaFeeds",   desc: "Post, Reels & Live" },
      { href: "/newsfeed",     emoji: "📰", label: "Newsfeed",   desc: "Pioneer community" },
      { href: "/reels",        emoji: "🎬", label: "Reels",       desc: "Short pioneer videos" },
      { href: "/live",         emoji: "🔴", label: "Live",        desc: "Live streams" },
      { href: "/supa-livvi",   emoji: "✨", label: "SupaLivvi",   desc: "Lifestyle & discovery" },
      { href: "/supa-saylo",   emoji: "🧵", label: "SupaSaylo",   desc: "Conversations & threads" },
      { href: "/supaspace",      emoji: "🪐", label: "SupaSpace",  desc: "Your Pi profile" },
    ],
  },
  {
    title: "Learn & Play",
    platforms: [
      { href: "/supademy",  emoji: "📚", label: "SupaDemy",      desc: "Learn & teach" },
      { href: "/supanova",   emoji: "🎮", label: "SupaNova",       desc: "Play & earn" },
      { href: "/rewards",  emoji: "🎁", label: "Daily Rewards",  desc: "Check-in & earn" },
      { href: "/referral", emoji: "🤝", label: "Referral",       desc: "Invite & earn" },
      { href: "/supapets", emoji: "🐾", label: "SupaPets",      desc: "Virtual pets & SC" },
    ],
  },
  {
    title: "Stay & Go",
    platforms: [
      { href: "/supastay",     emoji: "🏠", label: "SupaStay",      desc: "Rent with Pi" },
      { href: "/supaendoro",   emoji: "🛞", label: "SupaEndoro",    desc: "P2P vehicle rental" },
      { href: "/locator",  emoji: "📍", label: "Locator",       desc: "Pi businesses near you" },
      { href: "/pioneers", emoji: "🌍", label: "I Am a Pioneer", desc: "Find nearby Pioneers" },
    ],
  },
  {
    title: "Work",
    platforms: [
      { href: "/supahiro", emoji: "🧑‍💻", label: "SupaHiro", desc: "Hire & get hired" },
    ],
  },
  {
    title: "Wallet & Tools",
    platforms: [
      { href: "/wallet",   emoji: "💰", label: "Wallet",       desc: "Pi transactions" },
      { href: "/pi-value", emoji: "📈", label: "Market Value", desc: "Pi live market data" },
    ],
  },
];

const values = [
  { emoji: "🔥", title: "Bold by Design",        desc: "We do not build ordinary products. Every feature on Supapi is crafted to push boundaries, challenge convention, and deliver genuine value to every Pioneer who walks through our door." },
  { emoji: "🌍", title: "Community First",        desc: "Supapi was born from the community and will always serve the community. Every decision we make — every line of code we write — is guided by the needs and voices of real Pi Network users." },
  { emoji: "🔒", title: "Trust & Transparency",  desc: "In a space crowded with noise and broken promises, we choose integrity. We build in the open, communicate honestly, and never compromise on the trust our users place in us." },
  { emoji: "⚡", title: "Real Utility",           desc: "Pi has value. We are here to prove it — not through speculation, but through real products that let you earn, spend, trade, and grow using Pi every single day." },
];

export default function AboutPage() {
  return (
    <div className={styles.page}>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>ℹ️ About Supapi</div>
        <h1 className={styles.heroTitle}>
          Built for <span className={styles.heroGold}>Pioneers</span>.<br />By Pioneers.
        </h1>
        <p className={styles.heroSub}>
          We are Supapi — the Pi Network Super App on a mission to turn Pi from a mined coin into a thriving, real-world economy.
        </p>
        <div className={styles.heroActions}>
          <Link href="/supamarket" className={styles.btnPrimary}>Start Exploring</Link>
          <Link href="/referral" className={styles.btnOutline}>Earn Pi ↗</Link>
        </div>
      </section>

      {/* Who We Are */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.twoCol}>
            <div className={styles.textBlock}>
              <div className={styles.sectionLabel}>WHO WE ARE</div>
              <h2 className={styles.sectionTitle}>More Than an App. We Are Infrastructure.</h2>
              <p className={styles.bodyText}>
                Supapi is a comprehensive, community-driven super app built exclusively for the Pi Network ecosystem. From the moment Pi Browser opens, Supapi puts the full power of Pi utility directly into the hands of every Pioneer — whether you are a seasoned miner, a small business owner, a freelancer, a student, or simply someone who believes in the promise of decentralised finance.
              </p>
              <p className={styles.bodyText}>
                We are not just another app. We are the bridge between Pi coins sitting in wallets and real-world value being created, exchanged, and multiplied — every single day. We exist to answer one question that millions of Pioneers have asked since Day 1: <strong>"When can I actually use my Pi?"</strong> The answer is now. The answer is Supapi.
              </p>
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statNum}>25+</div>
                <div className={styles.statLabel}>Platforms</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statNum}>1</div>
                <div className={styles.statLabel}>Identity</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statNum}>∞</div>
                <div className={styles.statLabel}>Possibilities</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statNum}>π</div>
                <div className={styles.statLabel}>Currency</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className={styles.sectionDark}>
        <div className="container">
          <div className={styles.sectionLabel} style={{ color: "rgba(255,255,255,0.5)" }}>OUR STORY</div>
          <h2 className={styles.sectionTitleWhite}>From a Vision to a Movement</h2>
          <div className={styles.storyGrid}>
            <p className={styles.bodyTextLight}>
              Supapi was born from a simple but powerful frustration — watching millions of dedicated Pi Network miners accumulate coins with nowhere meaningful to spend them. The potential was undeniable. The utility was missing. So we decided to build it.
            </p>
            <p className={styles.bodyTextLight}>
              We started with a vision: create a single, seamless super app that covers every aspect of a Pioneer's digital and economic life. A platform where Pi is not just held — it is earned, spent, traded, and celebrated. Where the Pi ecosystem does not just promise real-world value, but delivers it, feature by feature, day by day.
            </p>
            <p className={styles.bodyTextLight}>
              Today, Supapi stands as one of the most comprehensive Pi-native platforms ever built — home to sixteen unique platforms, thousands of Pioneers, and a growing network of Pi-accepting merchants, freelancers, educators, and creators. And we are only getting started.
            </p>
            <p className={styles.bodyTextLight}>
              Every update, every new feature, every line of code is written with one goal: to make Pi Network's promise a daily reality for every Pioneer on Earth.
            </p>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionLabel}>WHAT WE STAND FOR</div>
          <h2 className={styles.sectionTitle}>Our Core Values</h2>
          <div className={styles.valuesGrid}>
            {values.map(v => (
              <div key={v.title} className={styles.valueCard}>
                <div className={styles.valueEmoji}>{v.emoji}</div>
                <h3 className={styles.valueTitle}>{v.title}</h3>
                <p className={styles.valueDesc}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms by category */}
      <section className={styles.sectionAlt}>
        <div className="container">
          <div className={styles.sectionLabel}>WHAT WE OFFER</div>
          <h2 className={styles.sectionTitle}>Our Platforms. One Super App.</h2>
          <p className={styles.bodyText} style={{ marginBottom: 40, maxWidth: 600 }}>
            Supapi is not one thing — it is many powerful platforms united under one roof, one wallet, and one Pi identity.
          </p>
          <div className={styles.platformCategories}>
            {platformCategories.map(cat => (
              <div key={cat.title} className={styles.platformCategory}>
                <h3 className={styles.platformCategoryTitle}>{cat.title}</h3>
                <div className={styles.platformGrid}>
                  {cat.platforms.map(p => (
                    <Link key={p.href} href={p.href} className={styles.platformCard}>
                      <span className={styles.platformEmoji}>{p.emoji}</span>
                      <span className={styles.platformLabel}>{p.label}</span>
                      <span className={styles.platformDesc}>{p.desc}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className={styles.sectionDark}>
        <div className="container" style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <div className={styles.sectionLabel} style={{ color: "rgba(255,255,255,0.5)" }}>OUR VISION</div>
          <h2 className={styles.sectionTitleWhite}>A World Where Pi is Everywhere</h2>
          <p className={styles.bodyTextLight} style={{ fontSize: 16, lineHeight: 1.9, marginBottom: 16 }}>
            We envision a world where Pi is not just mined — it is used. Where every cup of coffee, every freelance project, every product sold, and every service rendered can be transacted in Pi. Where a miner in Paris, Lagos, São Paulo, or Manila has equal access to economic opportunity simply by opening Supapi.
          </p>
          <p className={styles.bodyTextLight} style={{ fontSize: 16, lineHeight: 1.9, marginBottom: 32 }}>
            We are building that world — one feature, one Pioneer, one transaction at a time. And we need you with us.
          </p>
          <Link href="/referral" className={styles.btnGold}>Join the Movement →</Link>
        </div>
      </section>

      {/* Promise */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.promiseBox}>
            <div className={styles.promiseIcon}>🤝</div>
            <div>
              <h3 className={styles.promiseTitle}>Our Promise to Every Pioneer</h3>
              <p className={styles.promiseText}>
                Supapi will always be built with the Pioneer in mind. We will continue to expand, to innovate, and to listen. We will never compromise on quality, community, or trust. As Pi Network grows, Supapi grows with it — and so do you.
              </p>
              <p className={styles.promiseText} style={{ marginBottom: 0 }}>
                <strong>Welcome to Supapi. Welcome to the future of Pi.</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}