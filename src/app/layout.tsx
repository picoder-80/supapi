// app/layout.tsx

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { PiProvider } from "@/components/providers/PiProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";
import BottomNavSpacer from "@/components/layout/BottomNavSpacer";
import PublicPlatformFrame from "@/components/layout/PublicPlatformFrame";
import PlatformAIAssistant from "@/components/ai/PlatformAIAssistant";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Supapi", template: "%s | Supapi" },
  description: "The Pi Network Super App — Buy, sell, learn, play, and more.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1A2E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Pi Network SDK */}
        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <PiProvider>
          <AuthProvider>
            <TopBar />
            <main>
              <PublicPlatformFrame>{children}</PublicPlatformFrame>
            </main>
            <PlatformAIAssistant />
            {/* Spacer hanya untuk non-admin mobile pages */}
            <BottomNavSpacer />
            <BottomNav />
          </AuthProvider>
        </PiProvider>
      </body>
    </html>
  );
}
