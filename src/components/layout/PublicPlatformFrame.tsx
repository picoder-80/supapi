"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import styles from "./PublicPlatformFrame.module.css";

const PLATFORM_PREFIXES = [
  "/about",
  "/contact",
  "/faq",
  "/privacy",
  "/disclaimer",
  "/returns-refunds",
  "/terms",
  "/supamarket",
  "/supaskil",
  "/supademy",
  "/supastay",
  "/supanova",
  "/newsfeed",
  "/supafeeds",
  "/wallet",
  "/referral",
  "/locator",
  "/supahiro",
  "/rewards",
  "/reels",
  "/live",
  "/pi-value",
  "/supasifieds",
  "/supaspace",
  "/pioneers",
  "/supa-livvi",
  "/supa-saylo",
  "/supabulk",
  "/supaauto",
  "/supadomus",
  "/supaendoro",
  "/supapets",
  "/supascrow",
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
  return (
    <div className={framed ? styles.framed : styles.fullWidth}>
      {children}
    </div>
  );
}
