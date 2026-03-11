"use client";

// components/providers/PiProvider.tsx

import { createContext, useContext, useEffect, useState } from "react";
import { initPiSDK, isPiBrowser } from "@/lib/pi/sdk";

interface PiContextType {
  isReady:     boolean;
  isPiBrowser: boolean;
}

const PiContext = createContext<PiContextType>({
  isReady:     false,
  isPiBrowser: false,
});

export function PiProvider({ children }: { children: React.ReactNode }) {
  const [isReady,     setIsReady]     = useState(false);
  const [inPiBrowser, setInPiBrowser] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 100; // try for up to 10 seconds

    const tryInit = () => {
      attempts++;

      if (typeof window !== "undefined" && window.Pi) {
        // Pi SDK is ready
        try {
          initPiSDK();
        } catch (e) {
          console.warn("[PiProvider] initPiSDK error:", e);
        }
        setInPiBrowser(true);
        setIsReady(true);
        console.log("[PiProvider] Pi SDK ready ✅");
        return;
      }

      if (attempts >= maxAttempts) {
        // Not in Pi Browser — show UI anyway
        console.log("[PiProvider] Pi SDK not found — not in Pi Browser");
        setInPiBrowser(false);
        setIsReady(true);
        return;
      }

      // Retry every 100ms
      setTimeout(tryInit, 100);
    };

    tryInit();
  }, []);

  return (
    <PiContext.Provider value={{ isReady, isPiBrowser: inPiBrowser }}>
      {children}
    </PiContext.Provider>
  );
}

export const usePi = () => useContext(PiContext);