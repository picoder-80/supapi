"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

const CHANNEL = "online-users";

interface PresenceContextType {
  onlineUsers: Set<string>;
  isOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextType>({
  onlineUsers: new Set(),
  isOnline: () => false,
});

export function useOnlineStatus(userId: string | null | undefined): boolean {
  const { onlineUsers } = useContext(PresenceContext);
  if (!userId) return false;
  return onlineUsers.has(userId);
}

export default function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Clean up previous channel if user changes
    if (channelRef.current) {
      channelRef.current.untrack();
      createClient().removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!user?.id) return;

    const supabase = createClient();
    const channel  = supabase.channel(CHANNEL, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const ids = new Set(Object.keys(channel.presenceState()));
        console.log("✅ [Presence] sync — online:", [...ids]);
        setOnlineUsers(new Set(ids));
      })
      .on("presence", { event: "join" }, ({ key }: { key: string }) => {
        console.log("✅ [Presence] join:", key);
        setOnlineUsers(prev => new Set([...prev, key]));
      })
      .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
        console.log("⬇️ [Presence] leave:", key);
        setOnlineUsers(prev => { const s = new Set(prev); s.delete(key); return s; });
      })
      .subscribe(async (status: string) => {
        console.log("[Presence] channel status:", status);
        if (status === "SUBSCRIBED") {
          const trackResult = await channel.track({
            userId:    user.id,
            username:  user.username,
            online_at: new Date().toISOString(),
          });
          console.log("✅ [Presence] track result:", trackResult);
        }
      });

    channelRef.current = channel;

    const handleUnload = () => { channel.untrack(); };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      window.removeEventListener("beforeunload", handleUnload);
      channelRef.current = null;
    };
  }, [user?.id]);

  return (
    <PresenceContext.Provider value={{
      onlineUsers,
      isOnline: (id: string) => onlineUsers.has(id),
    }}>
      {children}
    </PresenceContext.Provider>
  );
}