"use client";

import Link from "next/link";
import styles from "../about/page.module.css";

const sections = [
  {
    id: "intro",
    title: "Introduction",
    content: [
      'Supapi ("we", "us", or "our") operates multiple platforms where Pioneers buy, sell, and transact using Pi and Supapi Credits (SC). This Return & Refund Policy explains how returns, refunds, and cancellations work across our platforms.',
      "By using Supapi, you agree to this policy. Platform-specific rules may apply; please refer to the relevant platform (e.g. SupaMarket, SupaScrow, SupaSkil) for additional details.",
    ],
  },
  {
    id: "escrow",
    title: "SupaScrow & Escrow Deals",
    content: [
      "SupaScrow holds funds in escrow until the buyer confirms delivery or a dispute is resolved. Refunds are processed when:",
      "• The buyer and seller agree to cancel before funding.",
      "• The deal is cancelled by either party before the seller accepts.",
      "• A dispute is resolved in favour of the buyer (full or partial refund).",
      "• The seller fails to ship or deliver as agreed.",
      "Refunds are issued in the original currency (Pi or SC) to the buyer's wallet or account. Processing may take a few minutes to 24 hours depending on the payment method.",
    ],
  },
  {
    id: "marketplace",
    title: "SupaMarket & Physical Products",
    content: [
      "Returns and refunds for SupaMarket orders use a return request first: after you confirm receipt, you can ask the seller for a refund. If the seller declines, you may ask for platform review before payment is released from escrow.",
      "Once you complete the order, funds are released to the seller and returns are handled directly between you and the seller unless a new case is raised under our policies.",
      "For items not as described, damaged in transit, or never received, open a dispute promptly. We will review the case and may issue a full or partial refund to the buyer.",
    ],
  },
  {
    id: "gigs",
    title: "SupaSkil & Gig Services",
    content: [
      "Gig and service orders (SupaSkil) follow the agreed deliverables and milestones. Cancellations before work begins may be refunded in full if both parties agree.",
      "If work has started, refunds depend on the stage of completion and the agreement between buyer and seller. Disputes are resolved on a case-by-case basis, considering deliverables, communication, and evidence provided.",
    ],
  },
  {
    id: "sc",
    title: "Supapi Credits (SC)",
    content: [
      "Supapi Credits (SC) are earned in-app rewards and may be used for certain platform features. SC spent on escrow, boosts, or other purchases is generally non-refundable once the transaction is complete.",
      "Exceptions may apply if a transaction was made in error, a platform bug occurred, or a dispute is resolved in your favour. Contact support with your transaction details for review.",
    ],
  },
  {
    id: "disputes",
    title: "Dispute Resolution",
    content: [
      "When disputes arise, we use a fair process that may include automated review and human review. We consider all evidence provided (messages, photos, tracking, etc.) and aim to resolve disputes within a reasonable timeframe.",
      "Suggested resolutions may be provided based on the evidence. Our team has final authority to make decisions. Dispute outcomes are binding on both parties.",
    ],
  },
  {
    id: "timeframes",
    title: "Timeframes",
    content: [
      "• Open disputes: Before releasing escrow or within a reasonable period after delivery (platform-specific).",
      "• Refund processing: Typically within 24–72 hours after a refund is approved.",
      "• Pi refunds: Credited to your Pi wallet; timing depends on Pi Network.",
      "• SC refunds: Credited to your Supapi Credits balance immediately.",
    ],
  },
  {
    id: "exceptions",
    title: "Exceptions",
    content: [
      "We reserve the right to refuse refunds in cases of fraud, abuse, policy violation, or where evidence does not support the claim. We may also take action against accounts that repeatedly abuse our refund or dispute processes.",
    ],
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    content: [
      'We may update this Return & Refund Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the "Last updated" date. Your continued use of Supapi after such changes constitutes acceptance of the updated policy.',
    ],
  },
  {
    id: "contact",
    title: "Contact Us",
    content: [
      "For questions about returns or refunds, or to open a dispute:",
      "Email: support@supapi.app",
      "Or use the in-app support, dispute options, or contact options available on the relevant Supapi platform.",
    ],
  },
];

export default function ReturnsRefundsPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBadge}>↩️ Return & Refund Policy</div>
        <h1 className={styles.heroTitle}>
          Returns & <span className={styles.heroGold}>Refunds</span>
        </h1>
        <p className={styles.heroSub}>
          We aim for fair and transparent resolution of returns, refunds, and disputes across all Supapi platforms.
        </p>
        <div className={styles.heroActions}>
          <Link href="/about" className={styles.btnPrimary}>About Supapi</Link>
          <Link href="/terms" className={styles.btnOutline}>Terms of Service</Link>
          <Link href="/privacy" className={styles.btnOutline}>Privacy Policy</Link>
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
              <h3 className={styles.promiseTitle}>Fair Resolution</h3>
              <p className={styles.promiseText}>
                We are committed to resolving disputes fairly and promptly. If you have an issue with a transaction, contact the other party first or open a dispute through the platform. Our team is here to help.
              </p>
              <Link href="/supascrow" className={styles.btnGold} style={{ display: "inline-block", marginTop: 12 }}>
                Learn About SupaScrow →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
