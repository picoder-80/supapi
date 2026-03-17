"use client";

import styles from "./ToastBanner.module.css";

type ToastType = "success" | "error" | "critical";

export default function ToastBanner({
  message,
  type,
}: {
  message: string;
  type: ToastType;
}) {
  const klass = type === "critical" ? styles.critical : type === "error" ? styles.error : styles.success;
  return (
    <div className={`${styles.toast} ${klass}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
