"use client";
export const dynamic = "force-dynamic";

import ComingSoonAdminPage from "@/components/admin/ComingSoonAdminPage";

export default function PlatformAdminPage() {
  return (
    <ComingSoonAdminPage
      icon="🎮"
      title="Arcade"
      subtitle="Pi-powered mini games"
      panelName="Arcade"
    />
  );
}