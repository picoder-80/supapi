"use client";
export const dynamic = "force-dynamic";

import ComingSoonAdminPage from "@/components/admin/ComingSoonAdminPage";

export default function PlatformAdminPage() {
  return (
    <ComingSoonAdminPage
      icon="🧑‍💻"
      title="Jobs"
      subtitle="Job listings & hiring"
      panelName="Jobs"
    />
  );
}