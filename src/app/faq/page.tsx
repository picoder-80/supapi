"use client";

import Link from "next/link";
import styles from "../about/page.module.css";

const categories = [
  {
    id: "general",
    title: "General",
    items: [
      {
        id: "what-is-supapi",
        q: "What is Supapi?",
        a: "Supapi is the Pi Network Super App — a comprehensive platform with 25+ integrated apps where Pioneers can buy, sell, learn, play, and transact using Pi. From SupaMarket and SupaScrow to SupaChat and SupaPets, Supapi puts real Pi utility in one place.",
      },
      {
        id: "how-to-sign-in",
        q: "How do I sign in?",
        a: "Sign in with your Pi Network account. Open Supapi in Pi Browser, tap Sign in with Pi, and authorise the connection. Your Pi username, display name, and avatar are used to create your Supapi profile.",
      },
      {
        id: "is-supapi-free",
        q: "Is Supapi free to use?",
        a: "Yes. Creating an account and using most Supapi platforms is free. Some features (e.g. listing boosts, premium options) may require Pi or Supapi Credits (SC). Sellers may pay small fees on completed transactions.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & Pi",
    items: [
      {
        id: "how-to-pay",
        q: "How do I pay with Pi?",
        a: "When you buy on SupaMarket, SupaScrow, or other platforms, you fund the order using Pi from your Pi wallet. Payments are processed through the Pi Network. You need Pi Browser and an active Pi account to pay.",
      },
      {
        id: "what-is-sc",
        q: "What are Supapi Credits (SC)?",
        a: "Supapi Credits (SC) are in-app rewards you earn for activities like completing your profile, daily check-ins, referrals, and platform milestones. SC can be used for escrow on SupaScrow, boosts, and other features.",
      },
      {
        id: "wallet-address",
        q: "Why do I need to add my Pi wallet address?",
        a: "Your public Pi wallet address is used to receive payments when you sell, get refunds, or receive payouts from escrow. Add it in your Dashboard profile under Pi Wallet Address.",
      },
    ],
  },
  {
    id: "marketplace",
    title: "Buying & Selling",
    items: [
      {
        id: "how-supascrow-works",
        q: "How does SupaScrow work?",
        a: "SupaScrow holds funds in escrow until the buyer confirms delivery. Flow: 1) Create deal, seller accepts. 2) Buyer funds escrow (Pi or SC). 3) Seller ships with tracking. 4) Buyer confirms delivery. 5) Funds released to seller. Open a dispute only if there is a problem.",
      },
      {
        id: "how-to-sell",
        q: "How do I sell on SupaMarket?",
        a: "Sign in, go to SupaMarket, and create a listing. Add title, description, price in Pi, photos, and delivery options. Buyers can purchase; funds go to escrow until delivery is confirmed.",
      },
      {
        id: "dispute",
        q: "What if I have a problem with a transaction?",
        a: "Contact the other party first. If you cannot resolve it, open a dispute before releasing escrow. We will review the case and may issue a refund or release funds based on the evidence.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & Profile",
    items: [
      {
        id: "complete-profile",
        q: "Why should I complete my profile?",
        a: "A complete profile builds trust with buyers and sellers, unlocks faster checkout, and earns you 10 SC as a one-time reward. Add display name, phone, email, address, and Pi wallet address in your Dashboard.",
      },
      {
        id: "change-username",
        q: "Can I change my username?",
        a: "Your username comes from your Pi Network account. To change it, you would need to update it in Pi Network. Supapi does not control Pi usernames.",
      },
    ],
  },
  {
    id: "support",
    title: "Support & Policies",
    items: [
      {
        id: "contact-support",
        q: "How do I contact support?",
        a: "Use the in-app support options, or email support@supapi.app. For legal or privacy matters, email legal@supapi.app or privacy@supapi.app.",
      },
      {
        id: "refund-policy",
        q: "What is your refund policy?",
        a: "See our Return & Refund Policy for details. Refunds depend on the platform and situation — escrow can be refunded before release; disputes are resolved case by case.",
      },
      {
        id: "more-info",
        q: "Where can I learn more?",
        a: "Visit our About page for our story and platforms. Check Privacy Policy, Terms of Service, and Disclaimer for legal information. Use the in-app assistant for tips on specific platforms.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBadge}>❓ FAQ</div>
        <h1 className={styles.heroTitle}>
          Frequently Asked <span className={styles.heroGold}>Questions</span>
        </h1>
        <p className={styles.heroSub}>
          Quick answers to common questions about Supapi and how to use our platforms.
        </p>
        <div className={styles.heroActions}>
          <Link href="/about" className={styles.btnPrimary}>About Supapi</Link>
          <Link href="/contact" className={styles.btnOutline}>Contact Us</Link>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.privacyNav}>
            {categories.map((cat) => (
              <a key={cat.id} href={`#${cat.id}`} className={styles.privacyNavLink}>
                {cat.title}
              </a>
            ))}
          </div>
          <div className={styles.privacyContent}>
            {categories.map((cat) => (
              <div key={cat.id} id={cat.id} className={styles.privacySection}>
                <h2 className={styles.privacyTitle}>{cat.title}</h2>
                <div className={styles.faqList}>
                  {cat.items.map((item) => (
                    <div key={item.id} id={item.id} className={styles.faqItem}>
                      <h3 className={styles.faqQuestion}>{item.q}</h3>
                      <p className={styles.faqAnswer}>{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.promiseBox}>
            <div className={styles.promiseIcon}>💬</div>
            <div>
              <h3 className={styles.promiseTitle}>Still have questions?</h3>
              <p className={styles.promiseText}>
                Use the in-app assistant for platform-specific help, or contact us at support@supapi.app. We are here to help Pioneers get the most out of Supapi.
              </p>
              <Link href="/contact" className={styles.btnGold} style={{ display: "inline-block", marginTop: 12 }}>
                Contact Us →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
