import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Supapi Terms of Service — Rules and conditions for using our platforms.",
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
