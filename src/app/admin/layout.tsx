// app/admin/layout.tsx
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import "@/styles/globals.css";
import "@/styles/admin.css";
import "@/styles/admin-page-shared.css";

export const metadata: Metadata = {
  title: { default: "Supapi Admin", template: "%s | Admin" },
  robots: "noindex, nofollow",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}