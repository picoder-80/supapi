"use client";

// components/providers/PiProvider.tsx

import { createContext, useContext, useEffect, useState } from "react";
import { initPiSDK, isPiBrowser } from "@/lib/pi/sdk";

interface PiContextType {
  isReady: boolean;
  isPiBrowser: boolean;
}

const PiContext = createContext<PiContextType>({
  isReady: false,
  isPiBrowser: false,
});

export function PiProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [inPiBrowser, setInPiBrowser] = useState(false);

  useEffect(() => {
    const init = () => {
      initPiSDK();
      setInPiBrowser(isPiBrowser());
      setIsReady(true);
    };

    if (typeof window !== "undefined" && window.Pi) {
      init();
    } else {
      const timeout = setTimeout(init, 500);
      return () => clearTimeout(timeout);
    }
  }, []);

  return (
    <PiContext.Provider value={{ isReady, isPiBrowser: inPiBrowser }}>
      {children}
    </PiContext.Provider>
  );
}

export const usePi = () => useContext(PiContext);
