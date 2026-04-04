"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

type NetworkHealth = {
  healthy: boolean;
  latency_ms: number;
  health: string;
  slot: number | null;
  version: { "solana-core"?: string } | null;
  checked_at: string;
  error: string | null;
};

type WalletResult = {
  address: string;
  lamports: number;
  pi: string;
  usd: string | null;
  pi_usd_rate: number | null;
};

type TxResult = {
  signature: string;
  confirmed: boolean;
  status: "success" | "failed";
  error: string | null;
  slot: number | null;
  block_time: string | null;
  sender: string | null;
  receiver: string | null;
  amount_pi: string;
  fee_pi: string;
  account_count: number;
};

type BlocksData = {
  current_slot: number;
  block_height: number | null;
  avg_tps: number | null;
  total_supply_pi: string | null;
  circulating_supply_pi: string | null;
};

export default function PiNetworkAdminPage() {
  const [token, setToken] = useState("");
  const [health, setHealth] = useState<NetworkHealth | null>(null);
  const [blocks, setBlocks] = useState<BlocksData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Wallet checker
  const [walletAddr, setWalletAddr] = useState("");
  const [walletResult, setWalletResult] = useState<WalletResult | null>(null);
  const [walletError, setWalletError] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);

  // Transaction verifier
  const [txSig, setTxSig] = useState("");
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [txError, setTxError] = useState("");
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => { setToken(localStorage.getItem("supapi_admin_token") ?? ""); }, []);

  const adminFetch = useCallback(async (url: string) => {
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [token]);

  const loadHealth = useCallback(async () => {
    if (!token) return;
    setHealthLoading(true);
    const [hr, br] = await Promise.all([
      adminFetch("/api/admin/pi-network?mode=health"),
      adminFetch("/api/admin/pi-network?mode=blocks"),
    ]);
    const hd = await hr.json().catch(() => ({}));
    const bd = await br.json().catch(() => ({}));
    if (hd?.success) setHealth(hd.data);
    if (bd?.success) setBlocks(bd.data);
    setHealthLoading(false);
  }, [token, adminFetch]);

  useEffect(() => { void loadHealth(); }, [loadHealth]);

  // Auto-refresh health every 30s
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => { void loadHealth(); }, 30_000);
    return () => clearInterval(timer);
  }, [token, loadHealth]);

  const checkWallet = async () => {
    const addr = walletAddr.trim();
    if (!addr) return;
    setWalletLoading(true);
    setWalletError("");
    setWalletResult(null);
    const r = await adminFetch(`/api/admin/pi-network?mode=balance&address=${encodeURIComponent(addr)}`);
    const d = await r.json().catch(() => ({}));
    if (d?.success) setWalletResult(d.data);
    else setWalletError(d?.error ?? "Failed to fetch balance");
    setWalletLoading(false);
  };

  const verifyTx = async () => {
    const sig = txSig.trim();
    if (!sig) return;
    setTxLoading(true);
    setTxError("");
    setTxResult(null);
    const r = await adminFetch(`/api/admin/pi-network?mode=transaction&signature=${encodeURIComponent(sig)}`);
    const d = await r.json().catch(() => ({}));
    if (d?.success) setTxResult(d.data);
    else setTxError(d?.error ?? "Transaction not found");
    setTxLoading(false);
  };

  return (
    <div className="adminPage">
      <AdminPageHero icon="🪐" title="Pi Network Explorer" subtitle="Pi Testnet RPC — wallet balances, transaction verifier, live block data" showBadge />
      <div className={styles.wrap}>

        {/* Network Health */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={`${styles.statVal} ${health?.healthy ? styles.green : styles.red}`}>
              {healthLoading ? "..." : health?.healthy ? "✅ Healthy" : "❌ Down"}
            </div>
            <div className={styles.statLabel}>Network Status</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal}>{health?.latency_ms ?? "—"}ms</div>
            <div className={styles.statLabel}>RPC Latency</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal}>{health?.slot ? Number(health.slot).toLocaleString() : "—"}</div>
            <div className={styles.statLabel}>Current Slot</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal}>{blocks?.avg_tps ?? "—"}</div>
            <div className={styles.statLabel}>Avg TPS</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal}>{blocks?.block_height ? Number(blocks.block_height).toLocaleString() : "—"}</div>
            <div className={styles.statLabel}>Block Height</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal}>{health?.version?.["solana-core"] ?? "—"}</div>
            <div className={styles.statLabel}>Node Version</div>
          </div>
          {blocks?.circulating_supply_pi && (
            <div className={styles.statCard}>
              <div className={styles.statVal}>{Number(blocks.circulating_supply_pi).toLocaleString()} π</div>
              <div className={styles.statLabel}>Circulating Supply</div>
            </div>
          )}
          <div className={styles.statCard} style={{ cursor: "pointer" }} onClick={() => void loadHealth()}>
            <div className={styles.statVal}>↻</div>
            <div className={styles.statLabel}>
              {healthLoading ? "Refreshing..." : health?.checked_at ? `${new Date(health.checked_at).toLocaleTimeString()}` : "Refresh"}
            </div>
          </div>
        </div>

        <div className={styles.grid2}>
          {/* Wallet Balance Checker */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>🔍 Wallet Balance Checker</div>
            <div className={styles.cardSub}>Query any Pi wallet address on Testnet</div>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                placeholder="Pi wallet address (base58)..."
                value={walletAddr}
                onChange={(e) => setWalletAddr(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void checkWallet()}
              />
              <button className={styles.btnGold} onClick={() => void checkWallet()} disabled={walletLoading}>
                {walletLoading ? "Checking..." : "Check"}
              </button>
            </div>

            {walletError && <div className={styles.errorBox}>{walletError}</div>}

            {walletResult && (
              <div className={styles.resultBox}>
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Address</span>
                  <span className={styles.resultVal} style={{ fontFamily: "monospace", fontSize: 11 }}>
                    {walletResult.address.slice(0, 12)}...{walletResult.address.slice(-8)}
                  </span>
                </div>
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Balance</span>
                  <span className={`${styles.resultVal} ${styles.big}`}>{walletResult.pi} π</span>
                </div>
                {walletResult.usd && (
                  <div className={styles.resultRow}>
                    <span className={styles.resultLabel}>USD Equivalent</span>
                    <span className={styles.resultVal}>${walletResult.usd}</span>
                  </div>
                )}
                {walletResult.pi_usd_rate && (
                  <div className={styles.resultRow}>
                    <span className={styles.resultLabel}>Pi Rate</span>
                    <span className={styles.resultVal}>${walletResult.pi_usd_rate} / Pi</span>
                  </div>
                )}
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Lamports</span>
                  <span className={styles.resultVal}>{Number(walletResult.lamports).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Transaction Verifier */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>✅ Transaction Verifier</div>
            <div className={styles.cardSub}>Verify any Pi transaction signature on-chain</div>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                placeholder="Transaction signature / txid..."
                value={txSig}
                onChange={(e) => setTxSig(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void verifyTx()}
              />
              <button className={styles.btnGold} onClick={() => void verifyTx()} disabled={txLoading}>
                {txLoading ? "Verifying..." : "Verify"}
              </button>
            </div>

            {txError && <div className={styles.errorBox}>{txError}</div>}

            {txResult && (
              <div className={styles.resultBox}>
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Status</span>
                  <span className={`${styles.badge} ${txResult.status === "success" ? styles.badgeOk : styles.badgeErr}`}>
                    {txResult.status === "success" ? "✅ Confirmed" : "❌ Failed"}
                  </span>
                </div>
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Slot</span>
                  <span className={styles.resultVal}>{txResult.slot ? Number(txResult.slot).toLocaleString() : "—"}</span>
                </div>
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Block Time</span>
                  <span className={styles.resultVal}>{txResult.block_time ? new Date(txResult.block_time).toLocaleString() : "—"}</span>
                </div>
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Amount</span>
                  <span className={`${styles.resultVal} ${styles.big}`}>{txResult.amount_pi} π</span>
                </div>
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Fee</span>
                  <span className={styles.resultVal}>{txResult.fee_pi} π</span>
                </div>
                {txResult.sender && (
                  <div className={styles.resultRow}>
                    <span className={styles.resultLabel}>Sender</span>
                    <span className={styles.resultVal} style={{ fontFamily: "monospace", fontSize: 11 }}>
                      {txResult.sender.slice(0, 12)}...{txResult.sender.slice(-6)}
                    </span>
                  </div>
                )}
                {txResult.receiver && (
                  <div className={styles.resultRow}>
                    <span className={styles.resultLabel}>Receiver</span>
                    <span className={styles.resultVal} style={{ fontFamily: "monospace", fontSize: 11 }}>
                      {txResult.receiver.slice(0, 12)}...{txResult.receiver.slice(-6)}
                    </span>
                  </div>
                )}
                {txResult.error && (
                  <div className={styles.resultRow}>
                    <span className={styles.resultLabel}>Error</span>
                    <span className={styles.resultVal} style={{ color: "#e53e3e" }}>{txResult.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RPC Info */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>🔗 RPC Endpoint</div>
          <div className={styles.rpcBox}>
            <code className={styles.rpcUrl}>https://rpc.testnet.minepi.com</code>
            <div className={styles.cardSub} style={{ marginTop: 6 }}>
              Pi Testnet · Solana-compatible RPC · Auto-refresh every 30s
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
