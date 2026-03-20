import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { expireMarketPendingOrders } from "@/lib/market/expire-pending-orders";

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
  const limit = Math.max(10, Math.min(500, Number(searchParams.get("limit") ?? "250")));
  try {
    const supabase = await createAdminClient();
    const result = await expireMarketPendingOrders({ supabase, limit });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
