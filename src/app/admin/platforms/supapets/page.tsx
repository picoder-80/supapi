"use client";
export const dynamic = "force-dynamic";

import ComingSoonAdminPage from "@/components/admin/ComingSoonAdminPage";

export default function PlatformAdminPage() {
  return (
    <ComingSoonAdminPage
      icon="🐾"
      title="SupaPets"
      subtitle="Manage pet services, pet listings, and trust signals"
      panelName="SupaPets"
    />
  );
}
