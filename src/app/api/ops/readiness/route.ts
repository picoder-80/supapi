import { NextRequest, NextResponse } from "next/server";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return process.env.NODE_ENV !== "production";

  const headerKey = req.headers.get("x-cron-key") ?? "";
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const queryKey = new URL(req.url).searchParams.get("key") ?? "";
  return headerKey === secret || bearer === secret || queryKey === secret;
}

function safeLen(v?: string) {
  return (v ?? "").trim().length;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const checks = {
      jwt_secret_present: Boolean(process.env.JWT_SECRET),
      jwt_secret_strong: safeLen(process.env.JWT_SECRET) >= 24,
      supabase_service_role_present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      cron_secret_present: Boolean(process.env.CRON_SECRET),
      cron_secret_strong: safeLen(process.env.CRON_SECRET) >= 24,
      ai_provider_configured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
      ai_alert_webhook_configured: Boolean(process.env.AI_ALERT_WEBHOOK_URL),
    };

    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
    const status = failed.length === 0 ? "ready" : failed.length <= 2 ? "warning" : "critical";

    return NextResponse.json({
      success: true,
      data: {
        status,
        checks,
        failed,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
