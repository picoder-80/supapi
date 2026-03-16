import { NextResponse } from "next/server";

type ProviderName = "anthropic" | "openai" | "deepseek" | "heuristic";

function parseProviderOrder(): ProviderName[] {
  const raw = process.env.AI_PROVIDER_ORDER ?? "anthropic,openai,deepseek,heuristic";
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as ProviderName[];

  const valid = parsed.filter((p): p is ProviderName => ["anthropic", "openai", "deepseek", "heuristic"].includes(p));
  if (valid.length === 0) return ["anthropic", "openai", "deepseek", "heuristic"];
  if (!valid.includes("heuristic")) valid.push("heuristic");
  return valid;
}

export async function GET() {
  try {
    // Public — only returns config status (no secrets)
    const order = parseProviderOrder();
    const available = {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
      heuristic: true,
    };

    const active_provider =
      order.find((p) => p === "heuristic" || (p === "anthropic" && available.anthropic) || (p === "openai" && available.openai) || (p === "deepseek" && available.deepseek)) ??
      "heuristic";

    return NextResponse.json({
      success: true,
      data: {
        provider_order: order,
        available,
        active_provider,
        models: {
          anthropic: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022",
          openai: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          deepseek: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        },
        dispute_policy: {
          aggressive_auto: process.env.MARKET_AI_AGGRESSIVE_AUTO !== "false",
          auto_resolve_threshold: Number(process.env.MARKET_AI_AUTO_RESOLVE_THRESHOLD ?? "0.75"),
          max_auto_resolve_pi: Number(process.env.MARKET_AI_MAX_AUTO_RESOLVE_PI ?? "300"),
        },
        alerts: {
          webhook_configured: Boolean(process.env.AI_ALERT_WEBHOOK_URL),
        },
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
