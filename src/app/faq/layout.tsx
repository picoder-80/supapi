import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Supapi FAQ — Frequently asked questions about our platforms and how to use them.",
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
