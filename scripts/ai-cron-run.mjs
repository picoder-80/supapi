#!/usr/bin/env node

/**
 * Usage:
 *   npm run ai:cron:run
 *
 * Optional env:
 *   AI_CRON_URL      (default: http://localhost:3000/api/market/ai/dispute/cron-check)
 *   AI_CRON_LIMIT    (default: 25)
 *   CRON_SECRET      (used as x-cron-key header)
 */

const baseUrl = process.env.AI_CRON_URL ?? "http://localhost:3000/api/market/ai/dispute/cron-check";
const limit = Number(process.env.AI_CRON_LIMIT ?? "25");
const secret = process.env.CRON_SECRET ?? "";

function withLimit(url, n) {
  const u = new URL(url);
  u.searchParams.set("limit", String(n));
  return u.toString();
}

async function main() {
  try {
    const url = withLimit(baseUrl, Number.isFinite(limit) ? limit : 25);
    const headers = {};
    if (secret) headers["x-cron-key"] = secret;

    const res = await fetch(url, { method: "POST", headers });
    const body = await res.json().catch(() => ({}));

    if (!res.ok || !body?.success) {
      console.error("AI cron run failed.");
      console.error("status:", res.status);
      console.error("response:", JSON.stringify(body, null, 2));
      process.exit(1);
    }

    console.log("AI cron run OK");
    console.log(JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("AI cron run error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
