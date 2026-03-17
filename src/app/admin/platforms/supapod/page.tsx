"use client";
export const dynamic = "force-dynamic";

import ComingSoonAdminPage from "@/components/admin/ComingSoonAdminPage";

export default function AdminPodcastPage() {
  return (
    <ComingSoonAdminPage
      icon="🎙️"
      title="SupaPod"
      subtitle="Podcast platform — browse, create, listen, tip with Pi"
      panelName="SupaPod"
    />
  );
}
