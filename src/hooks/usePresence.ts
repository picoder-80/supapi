// hooks/usePresence.ts
// Supabase Realtime Presence — track online users

"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Broadcast own presence, returns a set of online userIds
export function usePresence(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel  = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: string }>();
        const ids = new Set(Object.keys(state));
        setOnlineUsers(ids);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        setOnlineUsers(prev => new Set([...prev, key]));
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUsers(prev => { const s = new Set(prev); s.delete(key); return s; });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const isOnline = (targetUserId: string) => onlineUsers.has(targetUserId);

  return { onlineUsers, isOnline };
}

// Lightweight hook — just check if a specific user is online
export function useIsOnline(targetUserId: string | null) {
  const [isOnline, setIsOnline] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!targetUserId) return;

    const supabase = createClient();
    const channel  = supabase.channel("online-users");

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setIsOnline(targetUserId in state);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key === targetUserId) setIsOnline(true);
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (key === targetUserId) setIsOnline(false);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [targetUserId]);

  return isOnline;
}