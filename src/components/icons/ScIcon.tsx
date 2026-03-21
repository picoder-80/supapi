"use client";

import styles from "./ScIcon.module.css";

type ScIconProps = {
  /** Emoji size (~font-size in px) */
  size?: number;
  className?: string;
  /** Hide from assistive tech when “SC” is already clear from nearby text / column header */
  decorative?: boolean;
};

/** Supapi Credits (SC) — 💎 system emoji (consistent across Pi / mobile). */
export default function ScIcon({ size = 16, className = "", decorative = false }: ScIconProps) {
  return (
    <span
      className={`${styles.wrap} ${className}`}
      style={{ fontSize: size }}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : "SC"}
    >
      💎
    </span>
  );
}
