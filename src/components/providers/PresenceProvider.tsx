"use client";

import { createContext, useContext, useEffect, useRef, useState , ReactNode } from "react";
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

export function useOnlineStatus(userId: string | null) {
  const { isOnline } = useContext(PresenceContext);
  if (!userId) return false;
  return isOnline(userId);
}

export default function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();

    // Join channel with own userId as presence key
    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set(Object.keys(state));
        console.log("✅ [Presence] sync — online:", [...ids]);
        setOnlineUsers(ids);
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
        console.log("[Presence] status:", status);
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: user.id,
            username: user.username,
            online_at: new Date().toISOString(),
          });
          console.log("✅ [Presence] tracking", user.username);
        }
      });

    channelRef.current = channel;
    window.addEventListener("beforeunload", () => channel.untrack());

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
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