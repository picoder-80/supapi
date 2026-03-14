export type AIProviderName = "anthropic" | "openai" | "heuristic";
export type AssistantMode = "assistant" | "growth" | "support" | "ops";

export type PlatformKey =
  | "about"
  | "myspace"
  | "market"
  | "gigs"
  | "academy"
  | "stay"
  | "arcade"
  | "newsfeed"
  | "wallet"
  | "referral"
  | "locator"
  | "jobs"
  | "rewards"
  | "reels"
  | "pi-value"
  | "classifieds"
  | "pioneers"
  | "supa-livvi"
  | "supa-saylo"
  | "bulkhub"
  | "machina-market"
  | "domus"
  | "endoro"
  | "supapets"
  | "dashboard"
  | "home";

export const SUPAPI_PLATFORM_KEYS: PlatformKey[] = [
  "home",
  "about",
  "myspace",
  "market",
  "gigs",
  "academy",
  "stay",
  "arcade",
  "newsfeed",
  "wallet",
  "referral",
  "locator",
  "jobs",
  "rewards",
  "reels",
  "pi-value",
  "classifieds",
  "pioneers",
  "supa-livvi",
  "supa-saylo",
  "bulkhub",
  "machina-market",
  "domus",
  "endoro",
  "supapets",
  "dashboard",
];

const PLATFORM_HELP: Record<PlatformKey, string> = {
  home: "Global app navigation, onboarding, and feature discovery.",
  about: "Brand details, mission, and product background.",
  myspace: "User profile, identity, and social presence.",
  market: "Listings, orders, disputes, and merchant flows.",
  gigs: "Freelance service offers, packages, and bookings.",
  academy: "Courses, learning paths, and content publishing.",
  stay: "Accommodation listings and host/guest operations.",
  arcade: "Game experiences and rewards flow.",
  newsfeed: "Community posts and discovery.",
  wallet: "Pi and Supapi Credit balance, transfers, and transactions.",
  referral: "Invite tracking, referral rewards, and payout status.",
  locator: "Discovery of Pi-friendly businesses and places.",
  jobs: "Hiring, candidate profiles, and job posting lifecycle.",
  rewards: "Daily rewards and SC earning actions.",
  reels: "Short-form media, engagement, and creator tools.",
  "pi-value": "Pi market/value references and conversion insights.",
  classifieds: "Ads and categorized community listings.",
  pioneers: "Pioneer map and community identity.",
  "supa-livvi": "Lifestyle content and social commerce moments.",
  "supa-saylo": "Threaded conversation and social posting.",
  bulkhub: "B2B wholesale marketplace workflows.",
  "machina-market": "Automotive listing and buying/selling flows.",
  domus: "Property marketplace and agent operations.",
  endoro: "Vehicle rental lifecycle and host-renter management.",
  supapets: "Virtual pet care, hatch loop, and SC rewards.",
  dashboard: "User account hub and quick access operations.",
};

type PlatformAIPreset = {
  quick_prompts: string[];
  focus_areas: string[];
  guardrails: string[];
};

const ASSISTANT_MODES: AssistantMode[] = ["assistant", "growth", "support", "ops"];

const MODE_GUIDANCE: Record<AssistantMode, string> = {
  assistant: "General helper mode. Prioritize clear next steps and concise practical guidance.",
  growth: "Growth mode. Focus on conversion, retention, engagement, and measurable KPI improvements.",
  support: "Support mode. Prioritize user communication quality, issue diagnosis, and safe resolution flow.",
  ops: "Operations mode. Prioritize reliability, monitoring, process consistency, and risk mitigation.",
};

const MODE_QUICK_PROMPTS: Record<AssistantMode, string[]> = {
  assistant: [
    "Give me the next 3 best actions right now",
    "Summarize this workflow simply",
    "What should I verify before submit?",
  ],
  growth: [
    "How can I improve conversion this week?",
    "Give me 3 growth experiments with quick wins",
    "How do I increase retention for this platform?",
  ],
  support: [
    "Draft a clear response for a frustrated user",
    "What troubleshooting checklist should support follow?",
    "How do I de-escalate this issue safely?",
  ],
  ops: [
    "Give me an ops checklist for stable execution",
    "What should I monitor daily for this platform?",
    "Where are the highest operational risks now?",
  ],
};

const PLATFORM_PRESETS: Partial<Record<PlatformKey, PlatformAIPreset>> = {
  market: {
    quick_prompts: [
      "Optimize my listing title and description for faster sales",
      "Give me dispute-safe communication template for buyer",
      "How do I reduce cancelled orders this week?",
    ],
    focus_areas: ["listing quality", "order conversion", "support/dispute handling"],
    guardrails: ["Never promise refunds outside policy", "Avoid asking users to pay off-platform"],
  },
  domus: {
    quick_prompts: [
      "Suggest better property listing copy for my target buyer",
      "What details should I add to increase inquiry rate?",
      "Create a safe response for lowball offers",
    ],
    focus_areas: ["property listing optimization", "inquiry handling", "price positioning"],
    guardrails: ["Do not provide legal/financial guarantees", "Keep offers transparent and documented"],
  },
  endoro: {
    quick_prompts: [
      "How to improve vehicle booking conversion?",
      "Draft host message for smoother handover",
      "How to reduce booking disputes?",
    ],
    focus_areas: ["rental conversion", "handover checklist", "booking trust/safety"],
    guardrails: ["No unsafe driving instructions", "No bypass of platform booking rules"],
  },
  "supa-livvi": {
    quick_prompts: [
      "Give me 5 content ideas for this week",
      "Suggest caption style for better engagement",
      "How to turn posts into product conversions?",
    ],
    focus_areas: ["content ideas", "engagement growth", "social commerce conversion"],
    guardrails: ["No spam-like growth tactics", "No misleading product claims"],
  },
  "supa-saylo": {
    quick_prompts: [
      "Rewrite my post to sound more engaging",
      "Give me a short reply for a heated comment",
      "Suggest 3 thread ideas around Pi utility",
    ],
    focus_areas: ["conversation quality", "community moderation tone", "thread engagement"],
    guardrails: ["Avoid harassment/toxic tone", "Avoid financial advice framing as certainty"],
  },
  rewards: {
    quick_prompts: [
      "How do I maximize daily SC rewards?",
      "Give me a 7-day reward checklist",
      "What should I do first with low SC balance?",
    ],
    focus_areas: ["reward optimization", "streak consistency", "SC balance planning"],
    guardrails: ["No exploit suggestions", "Respect fair-use/reward policies"],
  },
  wallet: {
    quick_prompts: [
      "Explain my best next wallet action today",
      "How to avoid transfer mistakes?",
      "What should I verify before sending SC?",
    ],
    focus_areas: ["transfer safety", "balance planning", "transaction verification"],
    guardrails: ["No secret/token exposure", "Always verify receiver identity"],
  },
  supapets: {
    quick_prompts: [
      "Best daily routine to grow pet stats faster",
      "How to spend SC wisely between hatch and items?",
      "Give me pet progression strategy for 7 days",
    ],
    focus_areas: ["pet progression", "care timing", "SC earn/spend loop"],
    guardrails: ["No abusive grinding patterns", "Keep progression fair and sustainable"],
  },
};

export function getPlatformAIPreset(platform: PlatformKey): PlatformAIPreset {
  const fallback: PlatformAIPreset = {
    quick_prompts: [
      `How to start with ${platform} step-by-step?`,
      "Show me a quick checklist before submit",
      "What are common mistakes to avoid here?",
    ],
    focus_areas: ["core flow", "quality checks", "error prevention"],
    guardrails: ["No policy bypass", "No unsafe or abusive actions"],
  };
  return PLATFORM_PRESETS[platform] ?? fallback;
}

export function getAssistantModes() {
  return ASSISTANT_MODES;
}

export function normalizeAssistantMode(input: unknown): AssistantMode {
  const mode = String(input ?? "assistant").trim().toLowerCase() as AssistantMode;
  return ASSISTANT_MODES.includes(mode) ? mode : "assistant";
}

export function getQuickPromptsForMode(platform: PlatformKey, mode: AssistantMode): string[] {
  const platformPrompts = getPlatformAIPreset(platform).quick_prompts;
  const modePrompts = MODE_QUICK_PROMPTS[mode] ?? MODE_QUICK_PROMPTS.assistant;
  return [...platformPrompts, ...modePrompts].slice(0, 4);
}

function getProviderOrder(): AIProviderName[] {
  const raw = process.env.AI_PROVIDER_ORDER ?? "anthropic,openai,heuristic";
  const parsed = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as AIProviderName[];
  const valid = parsed.filter((p): p is AIProviderName => ["anthropic", "openai", "heuristic"].includes(p));
  if (!valid.length) return ["anthropic", "openai", "heuristic"];
  if (!valid.includes("heuristic")) valid.push("heuristic");
  return valid;
}

async function callAnthropic(prompt: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022",
      max_tokens: 420,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.content?.[0]?.text ?? null;
}

async function callOpenAI(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? null;
}

function heuristicReply(
  platform: PlatformKey,
  mode: AssistantMode,
  message: string,
): { answer: string; suggestions: string[] } {
  const lower = message.toLowerCase();
  const suggestions = getQuickPromptsForMode(platform, mode).slice(0, 3);

  if (/error|failed|invalid|unauthorized|forbidden/.test(lower)) {
    return {
      answer: `I can help troubleshoot ${platform}. Start by checking auth token/session, required fields, and recent API responses. Then retry with one clean action and capture exact error text.`,
      suggestions,
    };
  }

  if (/how|cara|macam mana|guide|start/.test(lower)) {
    return {
      answer: `For ${platform}, start with the core flow first, validate one successful transaction, then expand to advanced features. Keep logs of each step so issues are easy to trace.`,
      suggestions,
    };
  }

  if (mode === "growth") {
    return {
      answer:
        `For ${platform}, prioritize one KPI at a time: conversion, retention, or engagement. Run short experiments, measure weekly impact, and keep only actions that improve user outcomes.`,
      suggestions,
    };
  }

  if (mode === "support") {
    return {
      answer:
        `For ${platform} support, acknowledge issue first, collect exact reproducible details, then provide one clear next action with ETA. Keep communication calm, specific, and policy-safe.`,
      suggestions,
    };
  }

  if (mode === "ops") {
    return {
      answer:
        `For ${platform} ops, use a repeatable checklist: verify service health, check failed actions, inspect recent logs, and confirm safeguards before changes. Stabilize first, optimize second.`,
      suggestions,
    };
  }

  if (platform === "market" && /listing|title|description|sell|buyer/.test(lower)) {
    return {
      answer:
        "For Marketplace, improve trust first: clear title, exact condition, 3-5 real photos, and explicit delivery terms. Then optimize price versus similar listings and respond to buyer questions fast.",
      suggestions,
    };
  }

  if ((platform === "domus" || platform === "endoro") && /price|pricing|offer|rate/.test(lower)) {
    return {
      answer:
        "Use a value-based price range: baseline market rate, then adjust by location, condition, and urgency. Keep one anchor price and one minimum acceptable price before negotiating.",
      suggestions,
    };
  }

  if (platform === "supapets" && /grow|level|xp|strategy|routine/.test(lower)) {
    return {
      answer:
        "Best SupaPets growth loop: keep all 4 stats above 70, rotate care actions on cooldown, and avoid long idle periods. Hatch only when SC buffer is healthy so routine rewards keep compounding.",
      suggestions,
    };
  }

  return {
    answer: `I can assist on ${platform}. Ask me for step-by-step actions, optimization ideas, or troubleshooting for your current task.`,
    suggestions,
  };
}

function platformEnabled(_platform: PlatformKey): boolean {
  const globalFlag = (process.env.AI_ENABLE_ALL_PLATFORMS ?? "true").toLowerCase() !== "false";
  return globalFlag;
}

export function getPlatformAIStatus() {
  const providerOrder = getProviderOrder();
  const availability = {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    heuristic: true,
  };
  const activeProvider =
    providerOrder.find((p) => availability[p as keyof typeof availability]) ?? "heuristic";

  return {
    provider_order: providerOrder,
    availability,
    active_provider: activeProvider,
    modes: ASSISTANT_MODES,
    global_enabled: (process.env.AI_ENABLE_ALL_PLATFORMS ?? "true").toLowerCase() !== "false",
    platforms: SUPAPI_PLATFORM_KEYS.map((platform) => ({
      platform,
      enabled: platformEnabled(platform),
      summary: PLATFORM_HELP[platform],
      quick_prompts: getQuickPromptsForMode(platform, "assistant"),
      focus_areas: getPlatformAIPreset(platform).focus_areas,
    })),
  };
}

export async function runPlatformAssistant(params: {
  platform: PlatformKey;
  mode?: AssistantMode;
  message: string;
  context?: string;
}) {
  const { platform, message, context } = params;
  const mode = normalizeAssistantMode(params.mode);
  if (!platformEnabled(platform)) {
    return {
      ok: false,
      provider: "heuristic" as AIProviderName,
      answer: `AI assistant is disabled for ${platform}.`,
      suggestions: [] as string[],
    };
  }

  const preset = getPlatformAIPreset(platform);
  const prompt = `You are Supapi AI assistant for "${platform}".
Assistant mode: ${mode}
Mode guidance: ${MODE_GUIDANCE[mode]}
Platform summary: ${PLATFORM_HELP[platform]}
Focus areas: ${preset.focus_areas.join(", ")}
Guardrails: ${preset.guardrails.join(" | ")}
User message: ${message}
Optional context: ${context ?? ""}

Return strict JSON only:
{
  "answer": "short practical answer",
  "suggestions": ["3 short next actions max"]
}

Rules:
- Keep answer under 120 words.
- Actionable and product-focused.
- No markdown.
`;

  const order = getProviderOrder();
  for (const provider of order) {
    try {
      if (provider === "anthropic") {
        const text = await callAnthropic(prompt);
        if (text) {
          const parsed = JSON.parse(String(text).replace(/```json|```/g, "").trim());
          return {
            ok: true,
            provider,
            answer: String(parsed?.answer ?? ""),
            suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions.map(String).slice(0, 3) : [],
          };
        }
      }

      if (provider === "openai") {
        const text = await callOpenAI(prompt);
        if (text) {
          const parsed = JSON.parse(String(text).replace(/```json|```/g, "").trim());
          return {
            ok: true,
            provider,
            answer: String(parsed?.answer ?? ""),
            suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions.map(String).slice(0, 3) : [],
          };
        }
      }

      if (provider === "heuristic") {
        const h = heuristicReply(platform, mode, message);
        return {
          ok: true,
          provider,
          answer: h.answer,
          suggestions: h.suggestions,
        };
      }
    } catch {
      // fall through
    }
  }

  const fallback = heuristicReply(platform, mode, message);
  return {
    ok: true,
    provider: "heuristic" as AIProviderName,
    answer: fallback.answer,
    suggestions: fallback.suggestions,
  };
}
