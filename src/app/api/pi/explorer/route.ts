import { NextResponse } from "next/server";

const HORIZON = "https://horizon.minepi.com";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "price";

  try {
    // ── PRICE ──────────────────────────────────────────────────────────
    if (type === "price") {
      let usd = 0, change24h = 0, high24h = 0, low24h = 0, vol24h = 0, source = "OKX";

      try {
        const r = await fetch("https://www.okx.com/api/v5/market/ticker?instId=PI-USDT", {
          next: { revalidate: 30 },
        });
        const d = await r.json();
        const t = d.data?.[0];
        if (t && parseFloat(t.last) > 0) {
          usd = parseFloat(t.last);
          change24h = parseFloat(t.sodUtc8)
            ? ((usd - parseFloat(t.sodUtc8)) / parseFloat(t.sodUtc8)) * 100
            : 0;
          high24h = parseFloat(t.high24h);
          low24h  = parseFloat(t.low24h);
          vol24h  = parseFloat(t.vol24h);
          source  = "OKX";
        }
      } catch {}

      // Fallback Gate.io
      if (!usd) {
        try {
          const r = await fetch("https://api.gateio.ws/api/v4/spot/tickers?currency_pair=PI_USDT", {
            next: { revalidate: 30 },
          });
          const d = await r.json();
          const g = d?.[0];
          if (g) {
            usd       = parseFloat(g.last);
            change24h = parseFloat(g.change_percentage) || 0;
            high24h   = parseFloat(g.high_24h);
            low24h    = parseFloat(g.low_24h);
            vol24h    = parseFloat(g.base_volume);
            source    = "Gate.io";
          }
        } catch {}
      }

      return NextResponse.json({ success: true, data: { usd, change24h, high24h, low24h, vol24h, source } });
    }

    // ── CANDLES ────────────────────────────────────────────────────────
    if (type === "candles") {
      const barMap: Record<string, string> = { "1H": "1H", "4H": "4H", "1D": "1Dutc" };
      const bar = barMap[searchParams.get("bar") ?? "1H"] ?? "1H";
      const r = await fetch(`https://www.okx.com/api/v5/market/candles?instId=PI-USDT&bar=${bar}&limit=48`, {
        next: { revalidate: 60 },
      });
      const d = await r.json();
      return NextResponse.json({ success: true, data: d.data ?? [] });
    }

    // ── LEDGERS ────────────────────────────────────────────────────────
    if (type === "ledgers") {
      const r = await fetch(`${HORIZON}/ledgers?order=desc&limit=1`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 10 },
      });
      const d = await r.json();
      return NextResponse.json({ success: true, data: d });
    }

    // ── TRANSACTIONS ───────────────────────────────────────────────────
    if (type === "transactions") {
      const r = await fetch(`${HORIZON}/transactions?order=desc&limit=10`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 10 },
      });
      const d = await r.json();
      return NextResponse.json({ success: true, data: d });
    }

    return NextResponse.json({ success: false, error: "Unknown type" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}