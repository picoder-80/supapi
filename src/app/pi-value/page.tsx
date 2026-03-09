"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./page.module.css";

// ── Types ──────────────────────────────────────────────────────────────
interface PriceData {
  usd: number;
  change24h: number;
  high24h: number;
  low24h: number;
  vol24h: number;
  source: string;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ── Helpers ────────────────────────────────────────────────────────────
function fmt(n: number, dec = 4) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Mini Candlestick Chart ─────────────────────────────────────────────
function CandleChart({ candles, loading }: { candles: Candle[]; loading: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (H / 4) * i);
      ctx.lineTo(W, (H / 4) * i);
      ctx.stroke();
    }

    const prices = candles.flatMap(c => [c.high, c.low]);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const padX = 4, padY = 10;
    const chartH = H - padY * 2;
    const candleW = Math.max(2, (W - padX * 2) / candles.length - 1);
    const toY = (p: number) => padY + chartH - ((p - minP) / range) * chartH;
    const toX = (i: number) => padX + i * ((W - padX * 2) / candles.length);

    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "rgba(245,166,35,0.3)");
    gradient.addColorStop(1, "rgba(245,166,35,0)");
    ctx.beginPath();
    candles.forEach((c, i) => {
      const x = toX(i) + candleW / 2;
      i === 0 ? ctx.moveTo(x, toY(c.close)) : ctx.lineTo(x, toY(c.close));
    });
    ctx.lineTo(toX(candles.length - 1) + candleW / 2, H);
    ctx.lineTo(toX(0) + candleW / 2, H);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    candles.forEach((c, i) => {
      const x = toX(i);
      const isUp = c.close >= c.open;
      const color = isUp ? "#27ae60" : "#e74c3c";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleW / 2, toY(c.high));
      ctx.lineTo(x + candleW / 2, toY(c.low));
      ctx.stroke();
      const bodyH = Math.max(1, Math.abs(toY(c.close) - toY(c.open)));
      ctx.fillRect(x, Math.min(toY(c.open), toY(c.close)), candleW, bodyH);
    });

    ctx.strokeStyle = "rgba(245,166,35,0.8)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    candles.forEach((c, i) => {
      const x = toX(i) + candleW / 2;
      i === 0 ? ctx.moveTo(x, toY(c.close)) : ctx.lineTo(x, toY(c.close));
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }, [candles]);

  if (loading) return <div className={styles.chartLoading} />;
  return <canvas ref={canvasRef} width={700} height={200} className={styles.canvas} />;
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function PiValuePage() {
  const [price, setPrice]       = useState<PriceData | null>(null);
  const [candles, setCandles]   = useState<Candle[]>([]);
  const [priceLoading, setPriceLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [interval, setIntervalState] = useState<"1H" | "4H" | "1D">("1H");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrice = useCallback(async () => {
    setPriceLoading(true);
    try {
      const res = await fetch("/api/pi/explorer?type=price");
      const d = await res.json();
      if (d.success && d.data?.usd) {
        setPrice(d.data);
        setLastUpdated(new Date());
      }
    } catch {}
    setPriceLoading(false);
  }, []);

  const fetchCandles = useCallback(async () => {
    setChartLoading(true);
    try {
      const barMap: Record<string, string> = { "1H": "1H", "4H": "4H", "1D": "1Dutc" };
      const bar = barMap[interval];
      const res = await fetch(`/api/pi/explorer?type=candles&bar=${bar}`);
      const d = await res.json();
      if (d.success && d.data) {
        const parsed: Candle[] = d.data.map((c: string[]) => ({
          time: parseInt(c[0]),
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
        })).reverse();
        setCandles(parsed);
      }
    } catch {}
    setChartLoading(false);
  }, [interval]);

  useEffect(() => { fetchPrice(); }, []);
  useEffect(() => { fetchCandles(); }, [fetchCandles]);
  useEffect(() => {
    const t = setInterval(fetchPrice, 30000);
    return () => clearInterval(t);
  }, [fetchPrice]);

  const isUp = (price?.change24h ?? 0) >= 0;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.piLogo}>π</div>
          <div>
            <h1 className={styles.headerTitle}>Pi Network</h1>
            <div className={styles.headerSub}>Live Market Data</div>
          </div>
          {lastUpdated && (
            <div className={styles.lastUpdated}>🟢 {lastUpdated.toLocaleTimeString()}</div>
          )}
        </div>
      </div>

      <div className={styles.body}>

        {/* Price Hero */}
        <div className={styles.priceHero}>
          {priceLoading ? (
            <div className={styles.priceSkeleton} />
          ) : price ? (
            <>
              <div className={styles.priceMain}>
                <div className={styles.priceUsd}>${fmt(price.usd)}</div>
                <div className={`${styles.priceChange} ${isUp ? styles.priceUp : styles.priceDown}`}>
                  {isUp ? "▲" : "▼"} {Math.abs(price.change24h).toFixed(2)}%
                </div>
              </div>
              <div className={styles.priceSource}>via {price.source} · auto-refresh 30s</div>
            </>
          ) : (
            <div className={styles.priceError}>Unable to fetch price</div>
          )}
        </div>

        {/* Stats Row */}
        {price && !priceLoading && (
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>24h High</div>
              <div className={styles.statValue}>${fmt(price.high24h)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>24h Low</div>
              <div className={styles.statValue}>${fmt(price.low24h)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Volume 24h</div>
              <div className={styles.statValue}>{(price.vol24h / 1e6).toFixed(2)}M π</div>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitle}>PI/USDT</div>
            <div className={styles.intervalBtns}>
              {(["1H", "4H", "1D"] as const).map(i => (
                <button key={i}
                  className={`${styles.intervalBtn} ${interval === i ? styles.intervalBtnActive : ""}`}
                  onClick={() => setIntervalState(i)}>{i}
                </button>
              ))}
            </div>
          </div>
          <CandleChart candles={candles} loading={chartLoading} />
          {candles.length > 0 && !chartLoading && (
            <div className={styles.chartFooter}>
              <span>Open: ${fmt(candles[0]?.open)}</span>
              <span>Close: ${fmt(candles[candles.length - 1]?.close)}</span>
            </div>
          )}
        </div>

        {/* Pi Converter */}
        <PiConverter usdRate={price?.usd ?? 0} />

        {/* External links */}
        <div className={styles.explorerLinks}>
          <div className={styles.explorerLinksTitle}>📊 Trade PI</div>
          <a href="https://www.okx.com/trade-spot/pi-usdt" target="_blank" rel="noreferrer" className={styles.explorerLink}>
            <span>📈</span>
            <div>
              <div className={styles.explorerLinkName}>OKX — PI/USDT</div>
              <div className={styles.explorerLinkUrl}>okx.com</div>
            </div>
            <span>↗</span>
          </a>
          <a href="https://www.gate.io/trade/PI_USDT" target="_blank" rel="noreferrer" className={styles.explorerLink}>
            <span>📊</span>
            <div>
              <div className={styles.explorerLinkName}>Gate.io — PI/USDT</div>
              <div className={styles.explorerLinkUrl}>gate.io</div>
            </div>
            <span>↗</span>
          </a>
          <a href="https://blockexplorer.minepi.com/mainnet" target="_blank" rel="noreferrer" className={styles.explorerLink}>
            <span>🔗</span>
            <div>
              <div className={styles.explorerLinkName}>Pi Block Explorer</div>
              <div className={styles.explorerLinkUrl}>blockexplorer.minepi.com</div>
            </div>
            <span>↗</span>
          </a>
        </div>

      </div>
    </div>
  );
}

// ── Pi Converter ───────────────────────────────────────────────────────
function PiConverter({ usdRate }: { usdRate: number }) {
  const [piAmt, setPiAmt] = useState("1");
  const pi = parseFloat(piAmt) || 0;

  return (
    <div className={styles.converter}>
      <div className={styles.converterTitle}>🔄 Pi Converter</div>
      <div className={styles.converterRow}>
        <div className={styles.converterInput}>
          <div className={styles.converterLabel}>π Pi</div>
          <input
            className={styles.converterField}
            type="number"
            min="0"
            step="0.01"
            value={piAmt}
            onChange={e => setPiAmt(e.target.value)}
          />
        </div>
        <div className={styles.converterEq}>=</div>
        <div className={styles.converterOutput}>
          <div className={styles.converterResult}>${(pi * usdRate).toFixed(4)} USD</div>
        </div>
      </div>
    </div>
  );
}