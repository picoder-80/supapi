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
  async redirects() {
    const slugs: [string, string][] = [
      ["/market", "/supamarket"],
      ["/gigs", "/supaskil"],
      ["/stay", "/supastay"],
      ["/academy", "/supademy"],
      ["/arcade", "/supanova"],
      ["/myspace", "/supaspace"],
      ["/jobs", "/supahiro"],
      ["/classifieds", "/supasifieds"],
      ["/bulkhub", "/supabulk"],
      ["/machina-market", "/supaauto"],
      ["/domus", "/supadomus"],
      ["/endoro", "/supaendoro"],
      ["/social-feeds", "/supafeeds"],
    ];
    const redirects: { source: string; destination: string; permanent: boolean }[] = [];
    for (const [oldPath, newPath] of slugs) {
      redirects.push({ source: oldPath, destination: newPath, permanent: true });
      redirects.push({ source: `${oldPath}/:path*`, destination: `${newPath}/:path*`, permanent: true });
    }
    redirects.push({ source: "/admin/market", destination: "/admin/supamarket", permanent: true });
    redirects.push({ source: "/admin/market/:path*", destination: "/admin/supamarket/:path*", permanent: true });
    return redirects;
  },
};

export default nextConfig;