"use client";
export const dynamic = "force-dynamic";
import ComingSoonAdminPage from "@/components/admin/ComingSoonAdminPage";

export default function PlatformAdminPage() {
  return (
    <ComingSoonAdminPage
      icon="🎬"
      title="Reels"
      subtitle="Short videos & creator content"
      panelName="Reels"
      features={[
        "Overview & analytics",
        "Video moderation",
        "Creator management",
        "Settings & configuration",
        "Reports & export",
      ]}
    />
  );
}