"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import styles from "./PublicPlatformFrame.module.css";

const PLATFORM_PREFIXES = [
  "/about",
  "/market",
  "/gigs",
  "/academy",
  "/stay",
  "/arcade",
  "/newsfeed",
  "/wallet",
  "/referral",
  "/locator",
  "/jobs",
  "/rewards",
  "/reels",
  "/pi-value",
  "/classifieds",
  "/myspace",
  "/pioneers",
  "/supa-livvi",
  "/supa-saylo",
  "/bulkhub",
  "/machina-market",
  "/domus",
  "/endoro",
  "/supapets",
  "/dashboard",
];

function shouldUsePlatformFrame(pathname: string): boolean {
  if (!pathname || pathname === "/") return false; // exclude homepage
  if (pathname.startsWith("/admin")) return false;
  return PLATFORM_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function PublicPlatformFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const framed = useMemo(() => shouldUsePlatformFrame(pathname), [pathname]);
  return <div className={framed ? styles.framed : undefined}>{children}</div>;
}
