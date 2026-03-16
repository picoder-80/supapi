"use client";

import { useEffect } from "react";

/**
 * When the app is embedded (e.g. in Pi sandbox iframe), set data-embedded on body
 * so CSS can add extra top padding to the header and avoid overlap with host UI.
 */
export default function EmbedDetect() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.self !== window.top) {
      document.body.dataset.embedded = "true";
    }
  }, []);
  return null;
}
