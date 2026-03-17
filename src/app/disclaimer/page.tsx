"use client";

import Link from "next/link";
import styles from "../about/page.module.css";

const sections = [
  {
    id: "intro",
    title: "Introduction",
    content: [
      'Supapi ("we", "us", or "our") provides this Disclaimer to inform users of the Pi Network Super App about important limitations, risks, and conditions of use. By accessing or using Supapi, you acknowledge that you have read, understood, and agree to be bound by this Disclaimer.',
    ],
  },
  {
    id: "no-advice",
    title: "No Financial or Investment Advice",
    content: [
      "Nothing on Supapi constitutes financial, investment, legal, tax, or other professional advice. We do not provide recommendations regarding the purchase, sale, or holding of Pi or any other digital asset. Any information about Pi value, market data, or pricing is for informational purposes only and should not be relied upon for investment decisions.",
      "You should conduct your own research and, where appropriate, seek independent professional advice before making any financial decisions.",
    ],
  },
  {
    id: "pi-network",
    title: "Pi Network Disclaimer",
    content: [
      "Supapi is an independent application built for the Pi Network ecosystem. We are not affiliated with, endorsed by, or operated by Pi Network or the Pi Core Team. Pi Network has its own terms, policies, and development roadmap.",
      "The availability, value, and future of Pi are determined by Pi Network and market forces. We do not guarantee that Pi will maintain any particular value, achieve mainnet, or be exchangeable for other assets. Use of Pi on Supapi is at your own risk.",
    ],
  },
  {
    id: "no-warranty",
    title: "No Warranty",
    content: [
      "Supapi and all its platforms, features, and content are provided on an \"as is\" and \"as available\" basis without warranties of any kind, either express or implied. We do not warrant that our services will be uninterrupted, error-free, secure, or free of viruses or other harmful components.",
      "We disclaim all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.",
    ],
  },
  {
    id: "third-party",
    title: "Third-Party Content & Services",
    content: [
      "Supapi may contain links to third-party websites, services, or content. We do not control, endorse, or assume responsibility for any third-party content, products, or services. Your interactions with third parties are solely between you and such parties.",
      "User-generated content (listings, posts, messages, reviews, etc.) is the responsibility of the users who create it. We do not verify the accuracy, legality, or quality of user content and disclaim liability for any harm arising from such content.",
    ],
  },
  {
    id: "transactions",
    title: "Transactions & Escrow",
    content: [
      "Buying, selling, and transacting on Supapi involves risk. We facilitate escrow and marketplace features but do not guarantee the performance of buyers, sellers, or counterparties. Disputes are resolved in accordance with our policies; outcomes may not satisfy all parties.",
      "You are responsible for verifying the identity, reputation, and legitimacy of other users before entering into transactions.",
    ],
  },
  {
    id: "limitation",
    title: "Limitation of Liability",
    content: [
      "To the fullest extent permitted by applicable law, Supapi and its operators, affiliates, and contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising from your use of or inability to use our services.",
      "Our total liability for any claims arising from your use of Supapi shall not exceed the amount you paid to us (if any) in the twelve (12) months preceding the claim, or one hundred (100) USD, whichever is less.",
    ],
  },
  {
    id: "user-responsibility",
    title: "Your Responsibility",
    content: [
      "You are solely responsible for your use of Supapi, including the security of your account, the accuracy of information you provide, and compliance with applicable laws in your jurisdiction.",
      "You must not use Supapi for any illegal, fraudulent, or abusive purpose. We reserve the right to suspend or terminate accounts that violate our policies or applicable law.",
    ],
  },
  {
    id: "changes",
    title: "Changes to This Disclaimer",
    content: [
      'We may update this Disclaimer from time to time. We will notify you of material changes by posting the updated disclaimer on this page and updating the "Last updated" date. Your continued use of Supapi after such changes constitutes acceptance of the updated disclaimer.',
    ],
  },
  {
    id: "contact",
    title: "Contact Us",
    content: [
      "If you have questions about this Disclaimer, please contact us at:",
      "Email: support@supapi.app",
      "Or via the in-app support or contact options available on Supapi.",
    ],
  },
];

export default function DisclaimerPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBadge}>⚠️ Disclaimer</div>
        <h1 className={styles.heroTitle}>
          Important <span className={styles.heroGold}>Notice</span>
        </h1>
        <p className={styles.heroSub}>
          Please read this Disclaimer carefully. It outlines important limitations and conditions that apply to your use of Supapi.
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
              <h3 className={styles.promiseTitle}>Use Responsibly</h3>
              <p className={styles.promiseText}>
                Supapi is built for Pioneers to earn, spend, and transact with Pi. We encourage you to use our services responsibly, understand the risks involved, and comply with applicable laws in your jurisdiction.
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
