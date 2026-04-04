import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

const PI_RPC_URL = "https://rpc.testnet.minepi.com";
const TIMEOUT_MS = 8000;
const LAMPORTS_PER_PI = 1_000_000_000; // 1 Pi = 1e9 lamports (Solana standard)

async function rpcCall(method: string, params: unknown[] = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(PI_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = await res.json();
    if (json?.error) return { ok: false, error: json.error?.message ?? "RPC error", data: json };
    return { ok: true, data: json };
  } catch (e: any) {
    clearTimeout(timer);
    return { ok: false, error: e?.name === "AbortError" ? "Timeout" : (e?.message ?? "Failed") };
  }
}

// GET — network health + optional wallet/tx query
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "health";

  // ── Mode: wallet balance ──────────────────────────────────────────────────
  if (mode === "balance") {
    const address = url.searchParams.get("address")?.trim() ?? "";
    if (!address) return NextResponse.json({ success: false, error: "Missing address" }, { status: 400 });

    const result = await rpcCall("getBalance", [address, { commitment: "confirmed" }]);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error });

    const lamports = Number(result.data?.result?.value ?? result.data?.result ?? 0);
    const pi = lamports / LAMPORTS_PER_PI;

    // Get Pi price for USD equivalent
    let piUsd = 0;
    try {
      const priceRes = await fetch("/api/pi-price", { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (priceRes?.ok) {
        const pd = await priceRes.json().catch(() => ({}));
        piUsd = Number(pd?.price ?? 0);
      }
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        address,
        lamports,
        pi: pi.toFixed(9),
        usd: piUsd > 0 ? (pi * piUsd).toFixed(2) : null,
        pi_usd_rate: piUsd > 0 ? piUsd : null,
      },
    });
  }

  // ── Mode: transaction verifier ────────────────────────────────────────────
  if (mode === "transaction") {
    const signature = url.searchParams.get("signature")?.trim() ?? "";
    if (!signature) return NextResponse.json({ success: false, error: "Missing signature/txid" }, { status: 400 });

    const result = await rpcCall("getTransaction", [
      signature,
      { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
    ]);

    if (!result.ok) return NextResponse.json({ success: false, error: result.error });

    const tx = result.data?.result;
    if (!tx) {
      return NextResponse.json({ success: false, error: "Transaction not found on Pi Testnet" });
    }

    const meta = tx.meta ?? {};
    const message = tx.transaction?.message ?? {};
    const accountKeys = message.accountKeys ?? [];

    // Extract sender/receiver from account keys
    const sender = accountKeys[0]?.pubkey ?? accountKeys[0] ?? null;
    const receiver = accountKeys[1]?.pubkey ?? accountKeys[1] ?? null;

    // Calculate amount transferred (pre - post balance)
    const preBalances = meta.preBalances ?? [];
    const postBalances = meta.postBalances ?? [];
    const lamportsMoved = preBalances[0] && postBalances[1]
      ? Math.abs(Number(postBalances[1]) - Number(preBalances[1]))
      : 0;
    const piMoved = lamportsMoved / LAMPORTS_PER_PI;

    const fee = Number(meta.fee ?? 0) / LAMPORTS_PER_PI;
    const success = meta.err === null;
    const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null;

    return NextResponse.json({
      success: true,
      data: {
        signature,
        confirmed: true,
        status: success ? "success" : "failed",
        error: meta.err ? JSON.stringify(meta.err) : null,
        slot: tx.slot ?? null,
        block_time: blockTime,
        sender,
        receiver,
        amount_pi: piMoved.toFixed(9),
        fee_pi: fee.toFixed(9),
        account_count: accountKeys.length,
      },
    });
  }

  // ── Mode: recent blocks ───────────────────────────────────────────────────
  if (mode === "blocks") {
    const [slot, blockHeight, supply] = await Promise.all([
      rpcCall("getSlot", [{ commitment: "confirmed" }]),
      rpcCall("getBlockHeight"),
      rpcCall("getSupply", [{ commitment: "confirmed" }]),
    ]);

    const currentSlot = Number(slot.data?.result ?? 0);

    // Get last 5 block times for TPS estimate
    const recentPerf = await rpcCall("getRecentPerformanceSamples", [5]);
    const samples = recentPerf.data?.result ?? [];
    const avgTps = samples.length
      ? samples.reduce((acc: number, s: any) => acc + Number(s.numTransactions ?? 0) / Math.max(1, Number(s.samplePeriodSecs ?? 60)), 0) / samples.length
      : null;

    const totalSupply = Number(supply.data?.result?.value?.total ?? 0) / LAMPORTS_PER_PI;
    const circulatingSupply = Number(supply.data?.result?.value?.circulating ?? 0) / LAMPORTS_PER_PI;

    return NextResponse.json({
      success: true,
      data: {
        current_slot: currentSlot,
        block_height: blockHeight.data?.result ?? null,
        avg_tps: avgTps ? Number(avgTps.toFixed(2)) : null,
        total_supply_pi: totalSupply > 0 ? totalSupply.toFixed(0) : null,
        circulating_supply_pi: circulatingSupply > 0 ? circulatingSupply.toFixed(0) : null,
      },
    });
  }

  // ── Mode: health (default) ────────────────────────────────────────────────
  const start = Date.now();
  const [health, slot, version] = await Promise.all([
    rpcCall("getHealth"),
    rpcCall("getSlot"),
    rpcCall("getVersion"),
  ]);
  const latencyMs = Date.now() - start;
  const isHealthy = health.ok && health.data?.result === "ok";

  return NextResponse.json({
    success: true,
    data: {
      healthy: isHealthy,
      latency_ms: latencyMs,
      rpc_url: PI_RPC_URL,
      checked_at: new Date().toISOString(),
      health: health.ok ? health.data?.result : health.error,
      slot: slot.ok ? slot.data?.result : null,
      version: version.ok ? version.data?.result : null,
      error: !health.ok ? health.error : null,
    },
  });
}
