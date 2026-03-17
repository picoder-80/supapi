import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "Supapi Disclaimer — Important limitations and conditions of use.",
};

export default function DisclaimerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
