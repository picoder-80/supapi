"use client";

import { usePathname } from "next/navigation";

export default function BottomNavSpacer() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <div className="bottom-nav-spacer" />;
}
