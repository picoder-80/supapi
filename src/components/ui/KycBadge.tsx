"use client";

import Image from "next/image";

type KycBadgeProps = {
  /** Size in pixels. Default 16. */
  size?: number;
  /** Optional title for accessibility */
  title?: string;
  className?: string;
};

/** Blue star-shaped KYC verified badge */
export default function KycBadge({ size = 16, title = "KYC Verified", className }: KycBadgeProps) {
  return (
    <Image
      src="/icons/kyc-badge.png"
      alt={title}
      width={size}
      height={size}
      title={title}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    />
  );
}
