"use client";

import Link from "next/link";
import styles from "../about/page.module.css";

const sections = [
  {
    id: "intro",
    title: "Introduction",
    content: [
      'Supapi ("we", "us", or "our") is the Pi Network Super App — a platform that enables Pioneers to buy, sell, learn, play, and transact using Pi. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services, platforms, and applications.',
      "By using Supapi, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.",
    ],
  },
  {
    id: "collect",
    title: "Information We Collect",
    content: [
      "We collect information that you provide directly to us, that we obtain from our integration with Pi Network, and that we gather automatically when you use our services.",
      "Account & Profile Information: When you sign in with Pi, we receive your Pi username, display name, avatar, and wallet address (when available). You may also provide additional profile details such as bio, email, phone, and shipping address.",
      "Transaction & Payment Data: We collect transaction details related to orders, escrow deals, payments, and Supapi Credits (SC) activity. This includes amounts, counterparties, and timestamps.",
      "Content & Communications: Messages you send in SupaChat, SupaScrow, or other platform features; listings, posts, reviews, and other content you create; and dispute or support communications.",
      "Usage & Device Data: We may collect information about how you use our services, including pages visited, features used, and approximate location. We may also collect device type, browser, and IP address for security and analytics.",
    ],
  },
  {
    id: "use",
    title: "How We Use Your Information",
    content: [
      "We use the information we collect to:",
      "• Provide, maintain, and improve our services across all Supapi platforms.",
      "• Process transactions, payments, and escrow activities.",
      "• Verify identity and prevent fraud.",
      "• Communicate with you about your account, orders, and support requests.",
      "• Enforce our terms, policies, and community guidelines.",
      "• Comply with legal obligations and protect our rights.",
      "• Analyze usage patterns to improve user experience and develop new features.",
    ],
  },
  {
    id: "pi",
    title: "Pi Network Integration",
    content: [
      "Supapi integrates with the Pi Network ecosystem. When you sign in with Pi, we receive data from Pi Network in accordance with Pi's own policies and the permissions you grant. We do not control Pi Network's data practices; please refer to Pi Network's privacy policy for information about how they handle your data.",
      "We use your Pi wallet address for payments, escrow, and payouts when you buy, sell, or receive funds.",
    ],
  },
  {
    id: "sharing",
    title: "Data Sharing & Third Parties",
    content: [
      "We do not sell your personal information. We may share your information with:",
      "• Service providers who assist us in operating our platform (e.g. hosting, analytics, payments, security).",
      "• Other users when necessary for transactions (e.g. buyer and seller details for orders, usernames in chat).",
      "• Law enforcement or regulatory bodies when required by law or to protect our rights and safety.",
      "• Affiliates or partners in connection with a merger, acquisition, or sale of assets, with appropriate notice.",
    ],
  },
  {
    id: "security",
    title: "Security",
    content: [
      "We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies & Tracking",
    content: [
      "We may use cookies, local storage, and similar technologies to maintain your session, remember preferences, and improve our services. You can control browser settings to limit or block cookies, though some features may not function correctly.",
    ],
  },
  {
    id: "rights",
    title: "Your Rights",
    content: [
      "Depending on your location, you may have the right to:",
      "• Access your personal data.",
      "• Correct inaccurate data.",
      "• Request deletion of your data.",
      "• Object to or restrict certain processing.",
      "• Data portability.",
      "To exercise these rights, contact us using the details below. We will respond within a reasonable timeframe.",
    ],
  },
  {
    id: "children",
    title: "Children's Privacy",
    content: [
      "Our services are not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us and we will take steps to delete such information.",
    ],
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    content: [
      "We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the \"Last updated\" date. Your continued use of Supapi after such changes constitutes acceptance of the updated policy.",
    ],
  },
  {
    id: "contact",
    title: "Contact Us",
    content: [
      "If you have questions about this Privacy Policy or our data practices, please contact us at:",
      "Email: privacy@supapi.app",
      "Or via the in-app support or contact options available on Supapi.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBadge}>🔒 Privacy Policy</div>
        <h1 className={styles.heroTitle}>
          Your Privacy <span className={styles.heroGold}>Matters</span>
        </h1>
        <p className={styles.heroSub}>
          We are committed to protecting your data and being transparent about how we collect, use, and safeguard your information.
        </p>
        <div className={styles.heroActions}>
          <Link href="/about" className={styles.btnPrimary}>About Supapi</Link>
          <Link href="/terms" className={styles.btnOutline}>Terms of Service</Link>
          <Link href="/disclaimer" className={styles.btnOutline}>Disclaimer</Link>
          <Link href="/returns-refunds" className={styles.btnOutline}>Returns & Refunds</Link>
          <Link href="#contact" className={styles.btnOutline}>Contact Us</Link>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <p className={styles.bodyText} style={{ marginBottom: 32 }}>
            <strong>Last updated:</strong> {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <div className={styles.privacyNav}>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={styles.privacyNavLink}>
                {s.title}
              </a>
            ))}
          </div>
          <div className={styles.privacyContent}>
            {sections.map((s) => (
              <div key={s.id} id={s.id} className={styles.privacySection}>
                <h2 className={styles.privacyTitle}>{s.title}</h2>
                <div className={styles.privacyBody}>
                  {s.content.map((para, i) => (
                    <p key={i} className={styles.bodyText}>
                      {para}
                    </p>
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
            <div className={styles.promiseIcon}>🤝</div>
            <div>
              <h3 className={styles.promiseTitle}>Our Commitment</h3>
              <p className={styles.promiseText}>
                Supapi is built for Pioneers. We treat your data with care, use it only to provide and improve our services, and never sell your personal information. If you have questions or concerns, we are here to help.
              </p>
              <Link href="/about" className={styles.btnGold} style={{ display: "inline-block", marginTop: 12 }}>
                Learn More About Us →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
