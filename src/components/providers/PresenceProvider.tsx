// components/providers/PresenceProvider.tsx
// Broadcasts current user's presence across the app

"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

export default function PresenceProvider() {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();
    const channel  = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId:    user.id,
          username:  user.username,
          online_at: new Date().toISOString(),
        });
      }
    });

    channelRef.current = channel;

    // Untrack on tab close / logout
    const handleUnload = () => { channel.untrack(); };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user?.id]);

  return null; // no UI
}