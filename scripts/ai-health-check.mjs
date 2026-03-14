#!/usr/bin/env node

/**
 * Usage:
 *   npm run ai:health
 *
 * Optional env:
 *   AI_HEALTH_URL   (default: http://localhost:3000/api/market/ai/health)
 *   CRON_SECRET     (used as x-cron-key header)
 */

const url = process.env.AI_HEALTH_URL ?? "http://localhost:3000/api/market/ai/health";
const secret = process.env.CRON_SECRET ?? "";

async function main() {
  try {
    const headers = {};
    if (secret) headers["x-cron-key"] = secret;

    const res = await fetch(url, { method: "GET", headers });
    const body = await res.json().catch(() => ({}));

    if (!res.ok || !body?.success) {
      console.error("AI health check failed.");
      console.error("status:", res.status);
      console.error("response:", JSON.stringify(body, null, 2));
      process.exit(1);
    }

    console.log("AI health check OK");
    console.log(JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("AI health check error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
