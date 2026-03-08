"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

// Single shared channel name — must match useIsOnline
export const PRESENCE_CHANNEL = "online-users";

export default function PresenceProvider() {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();

    // Use user.id as the presence key
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });

    channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId:    user.id,
          username:  user.username,
          online_at: new Date().toISOString(),
        });
        console.log(`✅ [Presence] SUBSCRIBED & tracking ${user.username} (${user.id})`);
      }
    });

    channelRef.current = channel;

    const handleUnload = () => { channel.untrack(); };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user?.id]);

  return null;
}