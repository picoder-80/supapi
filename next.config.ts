import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000", "supapi-mocha.vercel.app"] },
  },
  // Disable static prerendering — app needs dynamic auth
  staticPageGenerationTimeout: 0,
};

export default nextConfig;