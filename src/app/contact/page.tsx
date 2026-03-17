"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "../about/page.module.css";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setErrorMsg("");

    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const d = await r.json();

      if (d.success) {
        setStatus("success");
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        setStatus("error");
        setErrorMsg(d.error ?? "Failed to send.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBadge}>✉️ Contact Us</div>
        <h1 className={styles.heroTitle}>
          Get in <span className={styles.heroGold}>Touch</span>
        </h1>
        <p className={styles.heroSub}>
          Have a question or feedback? Send us a message and we will get back to you as soon as possible.
        </p>
        <div className={styles.heroActions}>
          <Link href="/faq" className={styles.btnPrimary}>View FAQ</Link>
          <Link href="/about" className={styles.btnOutline}>About Supapi</Link>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.contactCard}>
            <div className={styles.contactCardHeader}>
              <div className={styles.contactCardIcon}>✉️</div>
              <h2 className={styles.contactCardTitle}>Send a message</h2>
              <p className={styles.contactCardSub}>
                Your message goes to <strong>support@supapi.app</strong>. We typically respond within 24–48 hours.
              </p>
            </div>
            <form onSubmit={handleSubmit} className={styles.contactForm}>
              <div className={styles.contactFormRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="contact-name" className={styles.formLabel}>Name</label>
                  <input
                    id="contact-name"
                    type="text"
                    className={styles.contactInput}
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={status === "sending"}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="contact-email" className={styles.formLabel}>Email</label>
                  <input
                    id="contact-email"
                    type="email"
                    className={styles.contactInput}
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={status === "sending"}
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="contact-subject" className={styles.formLabel}>Subject</label>
                <input
                  id="contact-subject"
                  type="text"
                  className={styles.contactInput}
                  placeholder="What is this about? (optional)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={status === "sending"}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="contact-message" className={styles.formLabel}>Message</label>
                <textarea
                  id="contact-message"
                  className={styles.contactTextarea}
                  placeholder="Tell us how we can help..."
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  disabled={status === "sending"}
                />
              </div>
              {status === "success" && (
                <div className={styles.contactSuccess}>
                  <span className={styles.contactStatusIcon}>✓</span>
                  <span>Message sent successfully! We will get back to you soon.</span>
                </div>
              )}
              {status === "error" && (
                <div className={styles.contactError}>
                  <span className={styles.contactStatusIcon}>!</span>
                  <span>{errorMsg}</span>
                </div>
              )}
              <button
                type="submit"
                className={styles.contactSubmitBtn}
                disabled={status === "sending"}
              >
                {status === "sending" ? (
                  <>
                    <span className={styles.contactBtnSpinner} />
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.promiseBox}>
            <div className={styles.promiseIcon}>💬</div>
            <div>
              <h3 className={styles.promiseTitle}>Other ways to reach us</h3>
              <p className={styles.promiseText}>
                <strong>Support:</strong> support@supapi.app &nbsp;|&nbsp;
                <strong>Privacy:</strong> privacy@supapi.app &nbsp;|&nbsp;
                <strong>Legal:</strong> legal@supapi.app
              </p>
              <p className={styles.promiseText} style={{ marginBottom: 0 }}>
                You can also use the in-app assistant or check our FAQ for quick answers.
              </p>
              <Link href="/faq" className={styles.btnGold} style={{ display: "inline-block", marginTop: 12 }}>
                View FAQ →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
