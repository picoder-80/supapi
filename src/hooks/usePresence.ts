"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const PRESENCE_CHANNEL = "online-users";

// Check if a specific userId is currently online
// Joins the presence channel with a temporary observer key
export function useIsOnline(targetUserId: string | null) {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!targetUserId) return;

    const supabase  = createClient();
    // Join with a unique observer key so we get sync events
    const observerKey = `observer-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: observerKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        // Check if targetUserId exists as a key in presence state
        setIsOnline(targetUserId in state);
      })
      .on("presence", { event: "join" }, ({ key }: { key: string }) => {
        if (key === targetUserId) setIsOnline(true);
      })
      .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
        if (key === targetUserId) setIsOnline(false);
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          // Track as observer (lightweight, just to get sync)
          await channel.track({ observer: true });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [targetUserId]);

  return isOnline;
}

// Watch all online users + broadcast own presence
export function usePresence(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel  = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineUsers(new Set(Object.keys(channel.presenceState())));
      })
      .on("presence", { event: "join" }, ({ key }: { key: string }) => {
        setOnlineUsers(prev => new Set([...prev, key]));
      })
      .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
        setOnlineUsers(prev => { const s = new Set(prev); s.delete(key); return s; });
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { onlineUsers, isOnline: (id: string) => onlineUsers.has(id) };
}