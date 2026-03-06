// app/page.tsx

import Link from "next/link";
import styles from "./page.module.css";

const modules = [
  { href: "/market",    emoji: "🛍️",  label: "Marketplace",  desc: "Buy & sell items"       },
  { href: "/gigs",      emoji: "💼",  label: "Gigs",          desc: "Freelance services"     },
  { href: "/academy",   emoji: "📚",  label: "Academy",       desc: "Learn & teach"          },
  { href: "/stay",      emoji: "🏠",  label: "Stay",          desc: "Rent accommodations"    },
  { href: "/arcade",    emoji: "🎮",  label: "Arcade",        desc: "Play & earn Pi"         },
  { href: "/community", emoji: "👥",  label: "Community",     desc: "Forum & group buys"     },
  { href: "/wallet",    emoji: "💰",  label: "Wallet",        desc: "Transactions & history" },
  { href: "/referral",  emoji: "🤝",  label: "Referral",      desc: "Invite & earn Pi"       },
];

export default function HomePage() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroBadge}>🚀 Pi Network — Going Mainstream</div>
        <h1 className={styles.heroTitle}>
          <span className={styles.heroGold}>π</span> Supapi
        </h1>
        <p className={styles.heroSub}>
          The Pi Network Super App. One platform for everything you need in the Pi ecosystem.
        </p>
        <div className={styles.heroActions}>
          <Link href="/market" className={styles.btnPrimary}>Explore Now</Link>
          <Link href="/referral" className={styles.btnOutline}>Earn Pi ↗</Link>
        </div>
      </section>

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
    </main>
  );
}
