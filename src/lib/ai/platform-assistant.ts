export type AIProviderName = "anthropic" | "openai" | "heuristic";
export type AssistantMode = "assistant" | "growth" | "support" | "ops";
type ProviderCallResult = {
  text: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};
export type AIProviderRuntimeAlert = {
  provider: AIProviderName;
  level: "warn" | "info";
  message: string;
  last_seen_at: string;
  remaining_requests?: number | null;
  request_limit?: number | null;
  remaining_pct?: number | null;
  reset_at?: string | null;
};

export type PlatformKey =
  | "about"
  | "supaspace"
  | "supamarket"
  | "supaskil"
  | "supademy"
  | "supastay"
  | "supanova"
  | "newsfeed"
  | "wallet"
  | "referral"
  | "locator"
  | "supahiro"
  | "rewards"
  | "reels"
  | "pi-value"
  | "supasifieds"
  | "pioneers"
  | "supa-livvi"
  | "supa-saylo"
  | "supabulk"
  | "supaauto"
  | "supadomus"
  | "supaendoro"
  | "supapets"
  | "supascrow"
  | "dashboard"
  | "home";

export const SUPAPI_PLATFORM_KEYS: PlatformKey[] = [
  "home",
  "about",
  "supaspace",
  "supamarket",
  "supaskil",
  "supademy",
  "supastay",
  "supanova",
  "newsfeed",
  "wallet",
  "referral",
  "locator",
  "supahiro",
  "rewards",
  "reels",
  "pi-value",
  "supasifieds",
  "pioneers",
  "supa-livvi",
  "supa-saylo",
  "supabulk",
  "supaauto",
  "supadomus",
  "supaendoro",
  "supapets",
  "supascrow",
  "dashboard",
];

const PLATFORM_HELP: Record<PlatformKey, string> = {
  home: "Global app navigation, onboarding, and feature discovery.",
  about: "Brand details, mission, and product background.",
  supaspace: "User profile, identity, and social presence.",
  supamarket: "Listings, orders, disputes, and merchant flows.",
  supaskil: "Freelance service offers, packages, and bookings.",
  supademy: "Courses, learning paths, and content publishing.",
  supastay: "Accommodation listings and host/guest operations.",
  supanova: "Game experiences and rewards flow.",
  newsfeed: "Community posts and discovery.",
  wallet: "Pi and Supapi Credit balance, transfers, and transactions.",
  referral: "Invite tracking, referral rewards, and payout status.",
  locator: "Discovery of Pi-friendly businesses and places.",
  supahiro: "Hiring, candidate profiles, and job posting lifecycle.",
  rewards: "Daily rewards and SC earning actions.",
  reels: "Short-form media, engagement, and creator tools.",
  "pi-value": "Pi market/value references and conversion insights.",
  supasifieds: "Ads and categorized community listings.",
  pioneers: "Pioneer map and community identity.",
  "supa-livvi": "Lifestyle content and social commerce moments.",
  "supa-saylo": "Threaded conversation and social posting.",
  supabulk: "B2B wholesale marketplace workflows.",
  supaauto: "Automotive listing and buying/selling flows.",
  supadomus: "Property marketplace and agent operations.",
  supaendoro: "Vehicle rental lifecycle and host-renter management.",
  supapets: "Virtual pet care, hatch loop, and SC rewards.",
  supascrow: "Secure escrow for Pi/SC trades. Deal flow: create, fund, ship, confirm, release. Dispute handling.",
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
    "Help me prioritize my next steps",
    "Explain this workflow in plain language",
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
  supamarket: {
    quick_prompts: [
      "Optimize my listing title and description for faster sales",
      "Give me dispute-safe communication template for buyer",
      "How do I reduce cancelled orders this week?",
    ],
    focus_areas: ["listing quality", "order conversion", "support/dispute handling"],
    guardrails: ["Never promise refunds outside policy", "Avoid asking users to pay off-platform"],
  },
  supadomus: {
    quick_prompts: [
      "Suggest better property listing copy for my target buyer",
      "What details should I add to increase inquiry rate?",
      "Create a safe response for lowball offers",
    ],
    focus_areas: ["property listing optimization", "inquiry handling", "price positioning"],
    guardrails: ["Do not provide legal/financial guarantees", "Keep offers transparent and documented"],
  },
  supaendoro: {
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
  supascrow: {
    quick_prompts: [
      "How does the escrow flow work step by step?",
      "When should I open a dispute vs release funds?",
      "Best practices for safe cross-border escrow",
    ],
    focus_areas: ["escrow flow", "dispute handling", "trust & safety"],
    guardrails: ["Never advise paying outside platform", "Always verify tracking before release"],
  },
};

export function getPlatformAIPreset(platform: PlatformKey): PlatformAIPreset {
  const fallback: PlatformAIPreset = {
    quick_prompts: [
      `How to start with ${platform} step-by-step?`,
      "Give me a compact pre-submit checklist",
      "What pitfalls should I avoid first?",
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
  void platform;
  void mode;
  return [];
}

function getProviderOrder(): AIProviderName[] {
  const raw = process.env.AI_PROVIDER_ORDER ?? "anthropic,openai,heuristic";
  const parsed = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as AIProviderName[];
  const valid = parsed.filter((p): p is AIProviderName => ["anthropic", "openai", "heuristic"].includes(p));
  if (!valid.length) return ["anthropic", "openai", "heuristic"];
  if (!valid.includes("heuristic")) valid.push("heuristic");
  return valid;
}

const rateLimitWarnedState: Partial<Record<AIProviderName, string>> = {};
const runtimeProviderAlerts: Partial<Record<AIProviderName, AIProviderRuntimeAlert>> = {};

function parsePositiveNumber(input: string | null): number | null {
  if (!input) return null;
  const n = Number(input);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function getWarnThresholds(): number[] {
  const raw = process.env.AI_RATE_LIMIT_WARN_PERCENT ?? "20,10,5";
  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 100)
    .sort((a, b) => b - a);
  return parsed.length ? parsed : [20, 10, 5];
}

function maybeWarnRateLimit(params: {
  provider: AIProviderName;
  limitHeader: string | null;
  remainingHeader: string | null;
  resetHeader: string | null;
}) {
  const limit = parsePositiveNumber(params.limitHeader);
  const remaining = parsePositiveNumber(params.remainingHeader);
  if (!(limit && limit > 0) || remaining === null) return;
  const pct = (remaining / limit) * 100;
  const hit = getWarnThresholds().find((t) => pct <= t);
  if (!hit) return;
  const key = `${Math.floor(hit)}`;
  if (rateLimitWarnedState[params.provider] === key) return;
  rateLimitWarnedState[params.provider] = key;
  const nowIso = new Date().toISOString();
  const resetText = params.resetHeader ? ` reset=${params.resetHeader}` : "";
  runtimeProviderAlerts[params.provider] = {
    provider: params.provider,
    level: "warn",
    message: `Rate limit low: ${remaining}/${limit} requests left (${pct.toFixed(1)}%).`,
    last_seen_at: nowIso,
    remaining_requests: remaining,
    request_limit: limit,
    remaining_pct: Number(pct.toFixed(1)),
    reset_at: params.resetHeader ?? null,
  };
  console.warn(
    `[AI][${params.provider}] rate limit low: remaining=${remaining}/${limit} (${pct.toFixed(1)}%)${resetText}`
  );
}

export function getAIProviderRuntimeAlerts(): AIProviderRuntimeAlert[] {
  const list = Object.values(runtimeProviderAlerts).filter(Boolean) as AIProviderRuntimeAlert[];
  return list.sort((a, b) => String(b.last_seen_at).localeCompare(String(a.last_seen_at)));
}

export function getAIProviderRuntimeAlert(provider: AIProviderName): AIProviderRuntimeAlert | null {
  return runtimeProviderAlerts[provider] ?? null;
}

// Route to cheap Haiku for simple/short queries, Sonnet for complex ones
function selectAnthropicModel(prompt: string): string {
  const customModel = process.env.ANTHROPIC_MODEL;
  if (customModel) return customModel;
  const wordCount = prompt.trim().split(/\s+/).length;
  const isSimple = wordCount < 60 && !/analyz|explain|summar|compare|strateg|detail|step.by.step/i.test(prompt);
  return isSimple ? "claude-haiku-4-5" : "claude-sonnet-4-5";
}

async function callAnthropic(prompt: string, maxTokens?: number): Promise<ProviderCallResult | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const model = selectAnthropicModel(prompt);

  // Split prompt into cached system part + dynamic user message for cost savings
  const systemEnd = prompt.indexOf("User message:");
  const systemPart = systemEnd > 0 ? prompt.slice(0, systemEnd).trim() : "";
  const userPart = systemEnd > 0 ? prompt.slice(systemEnd).trim() : prompt;

  const messages = systemPart
    ? [{ role: "user", content: userPart }]
    : [{ role: "user", content: prompt }];

  const body: Record<string, unknown> = {
    model,
    max_tokens: Math.max(80, Math.floor(Number(maxTokens ?? 420))),
    temperature: 0.2,
    messages,
  };

  // Add prompt caching on system part if available (saves ~90% on repeated system prompts)
  if (systemPart) {
    body.system = [{ type: "text", text: systemPart, cache_control: { type: "ephemeral" } }];
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify(body),
  });
  maybeWarnRateLimit({
    provider: "anthropic",
    limitHeader: res.headers.get("anthropic-ratelimit-requests-limit"),
    remainingHeader: res.headers.get("anthropic-ratelimit-requests-remaining"),
    resetHeader: res.headers.get("anthropic-ratelimit-requests-reset"),
  });
  if (!res.ok) {
    if (res.status === 429) {
      runtimeProviderAlerts.anthropic = {
        provider: "anthropic",
        level: "warn",
        message: "Provider rate limited (429). Check billing/limits.",
        last_seen_at: new Date().toISOString(),
      };
      console.warn("[AI][anthropic] rate limited (429). Check usage/billing dashboard.");
    }
    return null;
  }
  const data = await res.json();
  const text = String(data?.content?.[0]?.text ?? "");
  if (!text) return null;
  return {
    text,
    model: String(data?.model ?? model),
    usage: {
      input_tokens: Number(data?.usage?.input_tokens ?? 0),
      output_tokens: Number(data?.usage?.output_tokens ?? 0),
      total_tokens: Number(data?.usage?.input_tokens ?? 0) + Number(data?.usage?.output_tokens ?? 0),
    },
  };
}

async function callOpenAI(prompt: string, maxTokens?: number): Promise<ProviderCallResult | null> {
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
      max_tokens: Math.max(80, Math.floor(Number(maxTokens ?? 420))),
      response_format: { type: "json_object" },
    }),
  });
  maybeWarnRateLimit({
    provider: "openai",
    limitHeader: res.headers.get("x-ratelimit-limit-requests"),
    remainingHeader: res.headers.get("x-ratelimit-remaining-requests"),
    resetHeader: res.headers.get("x-ratelimit-reset-requests"),
  });
  if (!res.ok) {
    if (res.status === 429) {
      runtimeProviderAlerts.openai = {
        provider: "openai",
        level: "warn",
        message: "Provider rate limited (429). Check billing/limits.",
        last_seen_at: new Date().toISOString(),
      };
      console.warn("[AI][openai] rate limited (429). Check usage/billing dashboard.");
    }
    return null;
  }
  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "");
  if (!text) return null;
  return {
    text,
    usage: {
      input_tokens: Number(data?.usage?.prompt_tokens ?? 0),
      output_tokens: Number(data?.usage?.completion_tokens ?? 0),
      total_tokens: Number(data?.usage?.total_tokens ?? 0),
    },
  };
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

  if (platform === "supamarket" && /listing|title|description|sell|buyer/.test(lower)) {
    return {
      answer:
        "For SupaMarket, improve trust first: clear title, exact condition, 3-5 real photos, and explicit delivery terms. Then optimize price versus similar listings and respond to buyer questions fast.",
      suggestions,
    };
  }

  if ((platform === "supadomus" || platform === "supaendoro") && /price|pricing|offer|rate/.test(lower)) {
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

  if (platform === "supascrow" && /escrow|dispute|release|fund|ship|flow/.test(lower)) {
    return {
      answer:
        "SupaScrow flow: 1) Create deal, seller accepts. 2) Buyer funds escrow (Pi or SC). 3) Seller ships with tracking. 4) Buyer confirms delivery. 5) Buyer releases funds. Open dispute only if goods are wrong or not received—never release before verifying.",
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
  maxTokens?: number;
  answerWordLimit?: number;
  generic?: boolean;
}) {
  const { platform, message, context } = params;
  const mode = normalizeAssistantMode(params.mode);
  const maxTokens = Math.max(80, Math.floor(Number(params.maxTokens ?? 420)));
  const answerWordLimit = Math.max(40, Math.floor(Number(params.answerWordLimit ?? 120)));
  const generic = Boolean(params.generic);
  if (!platformEnabled(platform)) {
    return {
      ok: false,
      provider: "heuristic" as AIProviderName,
      answer: `AI assistant is disabled for ${platform}.`,
      suggestions: [] as string[],
    };
  }

  const preset = getPlatformAIPreset(platform);
  const prompt = generic
    ? `You are a highly capable general AI assistant for SupaMinds users.
Assistant mode: ${mode}
Mode guidance: ${MODE_GUIDANCE[mode]}
User message: ${message}
Optional context: ${context ?? ""}

Return strict JSON only:
{
  "answer": "short practical answer",
  "suggestions": ["3 short next actions max"]
}

Rules:
- Keep answer under ${answerWordLimit} words.
- Actionable, clear, and broadly useful.
- No markdown.
`
    : `You are Supapi AI assistant for "${platform}".
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
- Keep answer under ${answerWordLimit} words.
- Actionable and product-focused.
- No markdown.
`;

  const order = getProviderOrder();
  for (const provider of order) {
    try {
      if (provider === "anthropic") {
        const result = await callAnthropic(prompt, maxTokens);
        if (result?.text) {
          const parsed = JSON.parse(String(result.text).replace(/```json|```/g, "").trim());
          return {
            ok: true,
            provider,
            model: result.model ?? "claude-sonnet-4-5",
            answer: String(parsed?.answer ?? ""),
            suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions.map(String).slice(0, 3) : [],
            usage: result.usage,
          };
        }
      }

      if (provider === "openai") {
        const result = await callOpenAI(prompt, maxTokens);
        if (result?.text) {
          const parsed = JSON.parse(String(result.text).replace(/```json|```/g, "").trim());
          return {
            ok: true,
            provider,
            model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
            answer: String(parsed?.answer ?? ""),
            suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions.map(String).slice(0, 3) : [],
            usage: result.usage,
          };
        }
      }

      if (provider === "heuristic") {
        const h = generic
          ? {
              answer: "I can help with writing, planning, troubleshooting, and general questions. Tell me your goal and constraints, and I will give a clear step-by-step answer.",
              suggestions: [],
            }
          : heuristicReply(platform, mode, message);
        return {
          ok: true,
          provider,
          model: "heuristic",
          answer: h.answer,
          suggestions: h.suggestions,
        };
      }
    } catch {
      // fall through
    }
  }

  const fallback = generic
    ? {
        answer: "I can help with writing, planning, troubleshooting, and general questions. Share what you want to achieve, and I will guide you step by step.",
        suggestions: [],
      }
    : heuristicReply(platform, mode, message);
  return {
    ok: true,
    provider: "heuristic" as AIProviderName,
    model: "heuristic",
    answer: fallback.answer,
    suggestions: fallback.suggestions,
  };
}
