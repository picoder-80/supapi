/**
 * Cron: Shopee-style auto receipt + auto complete for silent buyers.
 * Schedule daily (e.g. Vercel Cron → GET this URL).
 *
 * Env:
 *   MARKET_AUTO_CONFIRM_RECEIPT_DAYS — default 7 (after shipped / meetup_set)
 *   MARKET_AUTO_COMPLETE_ORDER_DAYS   — default 3 (after delivered)
 *   CRON_SECRET — same as other crons (x-cron-key, ?key=, or Bearer); Vercel cron header ok on prod
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { runMarketOrderAutoComplete } from "@/lib/market/run-order-auto-complete";

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const headerKey = req.headers.get("x-cron-key") ?? "";
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const queryKey = new URL(req.url).searchParams.get("key") ?? "";
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";

  if (secret && (headerKey === secret || bearer === secret || queryKey === secret)) return true;
  if (isVercelCron && process.env.VERCEL === "1") return true;

  return false;
}

async function run(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.max(5, Math.min(100, Number(searchParams.get("limit") ?? "40")));

  try {
    const supabase = await createAdminClient();
    const result = await runMarketOrderAutoComplete({ supabase, limit });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error("[auto-complete-cron]", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
