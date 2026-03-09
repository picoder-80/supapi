"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./AuthProvider";

// User is "online" if last_seen within 2 minutes
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const HEARTBEAT_INTERVAL  = 30 * 1000; // 30s

interface PresenceContextType {
  isOnline: (userId: string) => boolean;
  lastSeenMap: Record<string, string>;
}

const PresenceContext = createContext<PresenceContextType>({
  isOnline: () => false,
  lastSeenMap: {},
});

export function useOnlineStatus(userId: string | null | undefined): boolean {
  const { lastSeenMap } = useContext(PresenceContext);
  if (!userId) return false;
  const lastSeen = lastSeenMap[userId];
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;
}

export default function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, string>>({});

  // Heartbeat — update own last_seen every 30s
  useEffect(() => {
    if (!user?.id) return;

    const token = localStorage.getItem("supapi_token");
    if (!token) return;

    const beat = async () => {
      try {
        await fetch("/api/myspace/heartbeat", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        // Update own entry in map immediately
        setLastSeenMap(prev => ({
          ...prev,
          [user.id]: new Date().toISOString(),
        }));
      } catch {}
    };

    beat(); // immediate on login
    const interval = setInterval(beat, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Fetch last_seen for a specific user — called by useProfileOnline
  const fetchLastSeen = async (userId: string) => {
    try {
      const r = await fetch(`/api/myspace/lastseen/${userId}`);
      const d = await r.json();
      if (d.success && d.data?.last_seen) {
        setLastSeenMap(prev => ({ ...prev, [userId]: d.data.last_seen }));
      }
    } catch {}
  };

  return (
    <PresenceContext.Provider value={{
      isOnline: (id) => {
        const lastSeen = lastSeenMap[id];
        if (!lastSeen) return false;
        return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;
      },
      lastSeenMap,
    }}>
      {children}
    </PresenceContext.Provider>
  );
}

// Hook untuk check specific user online status — fetches from API
export function useProfileOnline(userId: string | null | undefined): boolean {
  const [isOnline, setIsOnline] = useState(false);
  const { lastSeenMap } = useContext(PresenceContext);

  useEffect(() => {
    if (!userId) return;

    const check = async () => {
      try {
        const r = await fetch(`/api/myspace/lastseen/${userId}`);
        const d = await r.json();
        if (d.success && d.data?.last_seen) {
          const diff = Date.now() - new Date(d.data.last_seen).getTime();
          setIsOnline(diff < ONLINE_THRESHOLD_MS);
        } else {
          setIsOnline(false);
        }
      } catch { setIsOnline(false); }
    };

    check();
    const interval = setInterval(check, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [userId]);

  // Also check local map (updates faster for own user)
  useEffect(() => {
    if (!userId) return;
    const lastSeen = lastSeenMap[userId];
    if (!lastSeen) return;
    setIsOnline(Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS);
  }, [userId, lastSeenMap]);

  return isOnline;
}