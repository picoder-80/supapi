import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Return & Refund Policy",
  description: "Supapi Return & Refund Policy — How returns, refunds, and disputes work across our platforms.",
};

export default function ReturnsRefundsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
