// app/page.tsx

import Link from "next/link";
import styles from "./page.module.css";

const modules = [
  { href: "/market",    emoji: "🛍️",  label: "Marketplace",   desc: "Buy & sell items"                },
  { href: "/gigs",      emoji: "💼",  label: "Gigs",           desc: "Freelance services"               },
  { href: "/academy",   emoji: "📚",  label: "Academy",        desc: "Learn & teach"                    },
  { href: "/stay",      emoji: "🏠",  label: "Stay",           desc: "Rent accommodations"              },
  { href: "/arcade",    emoji: "🎮",  label: "Arcade",         desc: "Play & earn Pi"                   },
  { href: "/community", emoji: "👥",  label: "Community",      desc: "Forum & group buys"               },
  { href: "/wallet",    emoji: "💰",  label: "Wallet",         desc: "Transactions & history"           },
  { href: "/referral",  emoji: "🤝",  label: "Referral",       desc: "Invite & earn Pi"                 },
  { href: "/locator",   emoji: "📍",  label: "Locator",        desc: "Find Pi-friendly businesses"      },
  { href: "/jobs",      emoji: "🧑‍💻",  label: "Jobs",           desc: "Hire & get hired"                },
  { href: "/rewards",   emoji: "🎁",  label: "Daily Rewards",  desc: "Check-in & earn Pi daily"         },
  { href: "/content",   emoji: "🎬",  label: "Content",        desc: "Creators & bloggers"              },
  { href: "/pi-value",  emoji: "📈",  label: "Market Value",   desc: "Pi price & blockchain explorer"   },
  { href: "/classifieds", emoji: "📋",  label: "Classifieds",     desc: "Promote services & businesses"    },
  { href: "/myspace",   emoji: "🪐",  label: "MySpace",        desc: "Your personal Pi profile"         },
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
          <Link href="/market"   className={styles.btnPrimary}>Explore Now</Link>
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

      {/* ── One Identity Banner ── */}
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
                {["🛍️ Buyer", "🏪 Seller", "🎓 Student", "👨‍🏫 Tutor", "🏠 Host", "🏡 Tenant", "💼 Freelancer", "🧑‍💻 Employer", "🎬 Creator", "🪐 Pioneer"].map((r) => (
                  <span key={r} className={styles.roleTag}>{r}</span>
                ))}
              </div>
            </div>
            <Link href="/market" className={styles.identityBtn}>Get Started →</Link>
          </div>
        </div>
      </section>

    </main>
  );
}