"use client";

import Link from "next/link";
import styles from "../about/page.module.css";

const sections = [
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    content: [
      'By accessing or using Supapi ("we", "us", or "our") — the Pi Network Super App and its platforms — you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use our services.',
      "We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page. Your continued use of Supapi after such changes constitutes acceptance of the updated Terms.",
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility",
    content: [
      "You must be at least 13 years of age to use Supapi. If you are under 18, you should have parental or guardian consent. You must have the legal capacity to enter into binding agreements in your jurisdiction.",
      "Access to Supapi requires a verified Pi Network account. Pi Network's own KYC process serves as identity and age verification.",
      "You must comply with all applicable laws in your country or region when using Supapi. We may restrict access from certain jurisdictions where our services are not permitted.",
    ],
  },
  {
    id: "account",
    title: "Account & Registration",
    content: [
      "You sign in to Supapi using your Pi Network account. You are responsible for maintaining the security of your Pi account and for all activity that occurs under it. We are not responsible for unauthorised access resulting from your failure to protect your credentials.",
      "You must provide accurate and complete information. You may not impersonate another person or entity, or use a false or misleading identity.",
    ],
  },
  {
    id: "use",
    title: "Use of Services",
    content: [
      "Supapi provides multiple platforms (SupaMarket, SupaScrow, SupaSkil, SupaChat, and others) for buying, selling, transacting, and engaging with the Pi community. You agree to use our services only for lawful purposes and in accordance with these Terms.",
      "We grant you a limited, non-exclusive, non-transferable, revocable licence to access and use Supapi for personal or commercial use as intended by each platform. We may modify, suspend, or discontinue any feature at any time.",
    ],
  },
  {
    id: "prohibited",
    title: "Prohibited Conduct",
    content: [
      "You must not:",
      "• Violate any applicable law or regulation.",
      "• Infringe the intellectual property or other rights of others.",
      "• Post false, misleading, defamatory, or harmful content.",
      "• Engage in fraud, scams, or deceptive practices.",
      "• Harass, abuse, or harm other users.",
      "• Use our services to distribute malware or interfere with our systems.",
      "• Circumvent security measures, access restrictions, or payment controls.",
      "• Use automated means (bots, scrapers) without our permission.",
      "We reserve the right to suspend or terminate accounts that violate these Terms.",
    ],
  },
  {
    id: "content",
    title: "User Content & Intellectual Property",
    content: [
      "You retain ownership of content you create (listings, posts, messages, etc.). By posting content, you grant us a worldwide, non-exclusive, royalty-free licence to use, display, and distribute it in connection with operating Supapi.",
      "Supapi's name, logo, design, and other materials are our intellectual property. You may not use them without our prior written consent.",
    ],
  },
  {
    id: "transactions",
    title: "Transactions & Payments",
    content: [
      "When you buy, sell, or transact on Supapi, you enter into a binding agreement with the other party. We facilitate transactions (including escrow) but are not a party to the underlying contract between buyers and sellers.",
      "Payments in Pi or Supapi Credits (SC) are subject to our payment and refund policies. We do not guarantee the performance of any user. Disputes are resolved in accordance with our Return & Refund Policy.",
    ],
  },
  {
    id: "platforms",
    title: "Platform-Specific Terms",
    content: [
      "Each Supapi platform (SupaMarket, SupaScrow, SupaSkil, SupaStay, etc.) may have additional terms, guidelines, or policies. By using a platform, you agree to comply with those terms. In case of conflict, these Terms take precedence unless the platform terms explicitly state otherwise.",
    ],
  },
  {
    id: "termination",
    title: "Termination",
    content: [
      "We may suspend or terminate your access to Supapi at any time, with or without cause or notice, including for violation of these Terms. You may stop using our services at any time.",
      "Upon termination, your right to use Supapi ceases. Provisions that by their nature should survive (e.g. disclaimers, limitation of liability, dispute resolution) will survive termination.",
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    content: [
      'Our services are provided "as is" and "as available" without warranties of any kind. We do not guarantee uninterrupted, error-free, or secure operation. We disclaim all implied warranties. Please refer to our Disclaimer for further details.',
    ],
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    content: [
      "To the fullest extent permitted by law, Supapi and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our services. Our total liability shall not exceed the amount you paid to us in the twelve (12) months preceding the claim, or one hundred (100) USD, whichever is less.",
    ],
  },
  {
    id: "disputes",
    title: "Dispute Resolution",
    content: [
      "For disputes between users (e.g. transactions), our dispute process applies as described in our Return & Refund Policy. For disputes between you and Supapi, you agree to first contact us to seek resolution. If we cannot resolve the matter, disputes may be submitted to binding arbitration or the courts, as permitted by applicable law.",
    ],
  },
  {
    id: "governing",
    title: "Governing Law",
    content: [
      "These Terms are governed by the laws of the jurisdiction in which Supapi operates, without regard to conflict of law principles. Any legal action must be brought in the courts of that jurisdiction.",
    ],
  },
  {
    id: "contact",
    title: "Contact Us",
    content: [
      "For questions about these Terms of Service:",
      "Email: legal@supapi.app",
      "Or via the in-app support or contact options available on Supapi.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBadge}>📜 Terms of Service</div>
        <h1 className={styles.heroTitle}>
          Terms of <span className={styles.heroGold}>Service</span>
        </h1>
        <p className={styles.heroSub}>
          Please read these Terms carefully. They govern your use of Supapi and all its platforms.
        </p>
        <div className={styles.heroActions}>
          <Link href="/about" className={styles.btnPrimary}>About Supapi</Link>
          <Link href="/privacy" className={styles.btnOutline}>Privacy Policy</Link>
          <Link href="/disclaimer" className={styles.btnOutline}>Disclaimer</Link>
          <Link href="#contact" className={styles.btnOutline}>Contact Us</Link>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <p className={styles.bodyText} style={{ marginBottom: 32 }}>
            <strong>Last updated:</strong> 25 March 2026
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
              <h3 className={styles.promiseTitle}>Built for Pioneers</h3>
              <p className={styles.promiseText}>
                Supapi exists to give Pi real utility. By using our services, you agree to these Terms and to use Supapi responsibly. We are committed to building a fair, transparent, and trustworthy platform for the Pi community.
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
