#!/usr/bin/env node

/**
 * Runs both checks in sequence:
 * 1) AI health
 * 2) AI dispute cron run
 *
 * Reuses env vars from:
 * - scripts/ai-health-check.mjs
 * - scripts/ai-cron-run.mjs
 */

import { spawn } from "node:child_process";

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
}

async function main() {
  try {
    console.log("=== AI Ops Check: Health ===");
    await runNodeScript("scripts/ai-health-check.mjs");

    console.log("\n=== AI Ops Check: Cron Run ===");
    await runNodeScript("scripts/ai-cron-run.mjs");

    console.log("\nAI ops check completed successfully.");
  } catch (err) {
    console.error("\nAI ops check failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
