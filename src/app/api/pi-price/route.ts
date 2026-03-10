// src/app/api/pi-price/route.ts
// GET /api/pi-price — fetch live Pi/USD price from CoinGecko (free, no API key)
// Cache 5 minutes to avoid rate limiting

import { NextResponse } from "next/server";

// In-memory cache
let cache: { price: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Return cached price if fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        price: cache.price,
        source: "cache",
        cached_at: new Date(cache.timestamp).toISOString(),
      });
    }

    // Fetch from CoinGecko free API — Pi Network mainnet coin ID: "pi-network"
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd",
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 }, // Next.js cache 5 min
      }
    );

    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);

    const data = await res.json();
    const price = data?.["pi-network"]?.usd;

    if (!price || typeof price !== "number") {
      throw new Error("Invalid price data from CoinGecko");
    }

    // Update cache
    cache = { price, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      price,
      source: "coingecko",
      fetched_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[pi-price] fetch failed:", err.message);

    // Return stale cache if available
    if (cache) {
      return NextResponse.json({
        success: true,
        price: cache.price,
        source: "stale_cache",
        cached_at: new Date(cache.timestamp).toISOString(),
        warning: "Live fetch failed, using cached price",
      });
    }

    // Last resort fallback — use a reasonable default
    return NextResponse.json({
      success: false,
      price: 0.22, // fallback if all fails
      source: "fallback",
      error: err.message,
    });
  }
}
