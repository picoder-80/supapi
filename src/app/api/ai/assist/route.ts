import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import {
  SUPAPI_PLATFORM_KEYS,
  getAssistantModes,
  getQuickPromptsForMode,
  getPlatformAIPreset,
  getPlatformAIStatus,
  normalizeAssistantMode,
  runPlatformAssistant,
  getAIProviderRuntimeAlert,
  type AIProviderName,
  type AssistantMode,
  type PlatformKey,
} from "@/lib/ai/platform-assistant";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MemoryRow = {
  platform: string;
  mode: string;
  question: string;
  answer: string;
  provider: string;
  created_at: string;
};

type MindEntitlement = {
  ok: boolean;
  error?: string;
  status?: string;
  plan_code?: string;
  monthly_limit?: number;
  used?: number;
  remaining?: number;
  topup_remaining?: number;
};
const FREE_MONTHLY_LIMIT = 12;
type GuardrailProfile = {
  maxMessageChars: number;
  memoryItems: number;
  maxTokens: number;
  answerWordLimit: number;
};
const lastPersistedAlertAt: Partial<Record<AIProviderName, string>> = {};

function stripProviderTag(text: string): string {
  return String(text ?? "")
    .replace(/\s*\[provider:(anthropic|openai|deepseek|heuristic)\]\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch {
    return null;
  }
}

function normalizePlatform(input: unknown): PlatformKey {
  const raw = String(input ?? "home").trim().toLowerCase() as PlatformKey;
  if (SUPAPI_PLATFORM_KEYS.includes(raw)) return raw;
  return "home";
}

function ymOfNow(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function getGuardrailProfile(planCode: string): GuardrailProfile {
  if (planCode === "power_monthly") {
    return { maxMessageChars: 2200, memoryItems: 8, maxTokens: 720, answerWordLimit: 180 };
  }
  if (planCode === "pro_monthly") {
    return { maxMessageChars: 1500, memoryItems: 5, maxTokens: 480, answerWordLimit: 130 };
  }
  return { maxMessageChars: 700, memoryItems: 2, maxTokens: 220, answerWordLimit: 75 };
}

async function checkAndConsumeSupaMindsUsage(userId: string): Promise<MindEntitlement> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const { data: sub } = await supabase
    .from("mind_subscriptions")
    .select(`
      status,
      current_period_end,
      grace_until,
      plan:plan_id ( code, features )
    `)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = String((sub as { status?: string } | null)?.status ?? "active");
  const periodEnd = new Date(String((sub as { current_period_end?: string } | null)?.current_period_end ?? "")).getTime();
  const graceUntil = new Date(String((sub as { grace_until?: string } | null)?.grace_until ?? "")).getTime();
  const planObj = asObj((sub as { plan?: unknown } | null)?.plan);
  const subPlanCode = String(planObj.code ?? "free");
  const features = asObj(planObj.features);

  const statusOk = status === "active"
    || (status === "canceled" && Number.isFinite(periodEnd) && now <= periodEnd)
    || (status === "grace" && Number.isFinite(graceUntil) && now <= graceUntil);
  const effectivePlanCode = statusOk ? subPlanCode : "free";

  const configuredLimit = Number(features.monthly_limit ?? 0);
  let monthlyLimit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 0;
  if (!(monthlyLimit > 0)) {
    const { data: plan } = await supabase
      .from("mind_plans")
      .select("features")
      .eq("code", effectivePlanCode)
      .maybeSingle();
    const planFeatures = asObj((plan as { features?: unknown } | null)?.features);
    const dbLimit = Number(planFeatures.monthly_limit ?? 0);
    if (Number.isFinite(dbLimit) && dbLimit > 0) monthlyLimit = dbLimit;
  }
  if (!(monthlyLimit > 0)) {
    monthlyLimit = effectivePlanCode === "power_monthly" ? 1800 : effectivePlanCode === "pro_monthly" ? 600 : FREE_MONTHLY_LIMIT;
  }

  const periodYm = ymOfNow();
  const { data: usage } = await supabase
    .from("mind_usage_monthly")
    .select("id, requests_count")
    .eq("user_id", userId)
    .eq("period_ym", periodYm)
    .maybeSingle();
  const used = Number((usage as { requests_count?: number } | null)?.requests_count ?? 0);
  const { data: topups } = await supabase
    .from("mind_topup_ledger")
    .select("id, prompts_remaining, prompts_used")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  const topupRemainingTotal = (topups ?? []).reduce((acc: number, row: any) => acc + Number(row.prompts_remaining ?? 0), 0);
  if (used >= monthlyLimit) {
    if (topupRemainingTotal > 0) {
      const chosen = (topups ?? []).find((r: any) => Number(r.prompts_remaining ?? 0) > 0);
      if (chosen?.id) {
        const nextRemaining = Math.max(0, Number(chosen.prompts_remaining ?? 0) - 1);
        await supabase
          .from("mind_topup_ledger")
          .update({
            prompts_used: Number(chosen.prompts_used ?? 0) + 1,
            prompts_remaining: nextRemaining,
            status: nextRemaining === 0 ? "consumed" : "active",
            updated_at: nowIso,
          })
          .eq("id", String(chosen.id));
        return {
          ok: true,
          status,
          plan_code: effectivePlanCode,
          monthly_limit: monthlyLimit,
          used,
          remaining: 0,
          topup_remaining: Math.max(0, topupRemainingTotal - 1),
        };
      }
    }
    return {
      ok: false,
      error: "Monthly SupaMinds limit reached. Upgrade your plan or wait for next cycle.",
      status,
      plan_code: effectivePlanCode,
      monthly_limit: monthlyLimit,
      used,
      remaining: 0,
      topup_remaining: topupRemainingTotal,
    };
  }

  if ((usage as { id?: string } | null)?.id) {
    await supabase
      .from("mind_usage_monthly")
      .update({ requests_count: used + 1, plan_code: effectivePlanCode, updated_at: nowIso })
      .eq("id", String((usage as { id: string }).id));
  } else {
    await supabase
      .from("mind_usage_monthly")
      .insert({
        user_id: userId,
        period_ym: periodYm,
        plan_code: effectivePlanCode,
        requests_count: 1,
        updated_at: nowIso,
      });
  }

  return {
    ok: true,
    status,
    plan_code: effectivePlanCode,
    monthly_limit: monthlyLimit,
    used: used + 1,
    remaining: Math.max(0, monthlyLimit - (used + 1)),
    topup_remaining: topupRemainingTotal,
  };
}

async function readRecentMemory(userId: string, limit = 20): Promise<MemoryRow[]> {
  try {
    const { data, error } = await supabase
      .from("ai_assistant_memory")
      .select("platform, mode, question, answer, provider, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return ((data ?? []) as MemoryRow[]).map((row) => ({
      ...row,
      answer: stripProviderTag(String(row.answer ?? "")),
    }));
  } catch {
    return [];
  }
}

async function writeMemory(params: {
  userId: string;
  platform: string;
  mode: string;
  question: string;
  answer: string;
  provider: string;
}) {
  try {
    await supabase.from("ai_assistant_memory").insert({
      user_id: params.userId,
      platform: params.platform,
      mode: params.mode,
      question: params.question,
      answer: stripProviderTag(params.answer),
      provider: params.provider,
      metadata: {},
    });
  } catch {
    // ignore DB write failure
  }
}

async function persistProviderAlertIfAny(provider: string) {
  const p = String(provider ?? "").toLowerCase() as AIProviderName;
  if (!["anthropic", "openai", "heuristic"].includes(p)) return;
  const alert = getAIProviderRuntimeAlert(p);
  if (!alert?.last_seen_at || lastPersistedAlertAt[p] === alert.last_seen_at) return;
  lastPersistedAlertAt[p] = alert.last_seen_at;
  try {
    await supabase.from("mind_ai_provider_alerts").insert({
      provider: alert.provider,
      level: alert.level,
      message: alert.message,
      remaining_requests: alert.remaining_requests ?? null,
      request_limit: alert.request_limit ?? null,
      remaining_pct: alert.remaining_pct ?? null,
      reset_at: alert.reset_at ?? null,
      source: "runtime",
      created_at: alert.last_seen_at,
    });
  } catch {
    // ignore alert persistence failure
  }
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  const status = getPlatformAIStatus();
  const recentMemory = userId ? await readRecentMemory(userId, 20) : [];
  return NextResponse.json({
    success: true,
    data: {
      ...status,
      modes: getAssistantModes(),
      recent_memory: recentMemory,
      memory_source: userId ? "server" : "anonymous",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json().catch(() => ({}));
    const platform = normalizePlatform(body?.platform);
    const mode: AssistantMode = normalizeAssistantMode(body?.mode);
    const message = String(body?.message ?? "").trim();
    const clientContext = String(body?.context ?? "").trim();
    const isSupaMindsChat = clientContext.toLowerCase().includes("channel:supaminds-chat");

    if (!message) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }
    let usageGate: MindEntitlement | null = null;
    let guardrails: GuardrailProfile = { maxMessageChars: 1200, memoryItems: 5, maxTokens: 420, answerWordLimit: 120 };
    if (isSupaMindsChat) {
      if (!userId) {
        return NextResponse.json({ success: false, error: "Sign in required for SupaMinds chat." }, { status: 401 });
      }
      usageGate = await checkAndConsumeSupaMindsUsage(userId);
      if (!usageGate.ok) {
        const isLimit = String(usageGate.error ?? "").toLowerCase().includes("limit");
        return NextResponse.json(
          {
            success: false,
            error: usageGate.error ?? "SupaMinds access denied.",
            data: { entitlement: usageGate },
          },
          { status: isLimit ? 429 : 403 }
        );
      }
      guardrails = getGuardrailProfile(String(usageGate.plan_code ?? "free"));
      if (message.length > guardrails.maxMessageChars) {
        return NextResponse.json(
          {
            success: false,
            error: `Message too long for current plan (max ${guardrails.maxMessageChars} characters).`,
            data: { entitlement: usageGate },
          },
          { status: 400 }
        );
      }
    } else if (message.length > guardrails.maxMessageChars) {
      return NextResponse.json({ success: false, error: "Message too long" }, { status: 400 });
    }

    const recentMemory = userId
      ? await readRecentMemory(userId, guardrails.memoryItems)
      : [];
    const memoryContext = recentMemory.length
      ? recentMemory
          .map((m, idx) => `#${idx + 1} [${m.platform}/${m.mode}] Q:${m.question}\nA:${m.answer}`)
          .join("\n\n")
      : "none";

    const mergedContext = `${clientContext}\nserver_recent_memory:\n${memoryContext}`.trim();
    const result = await runPlatformAssistant({
      platform,
      mode,
      message,
      context: mergedContext,
      maxTokens: guardrails.maxTokens,
      answerWordLimit: guardrails.answerWordLimit,
      generic: isSupaMindsChat,
    });
    const cleanAnswer = stripProviderTag(result.answer);
    const preset = getPlatformAIPreset(platform);
    const memoryPlatform = isSupaMindsChat ? "supaminds" : platform;
    await persistProviderAlertIfAny(result.provider);

    if (userId && result.ok && cleanAnswer) {
      await writeMemory({
        userId,
        platform: memoryPlatform,
        mode,
        question: message,
        answer: cleanAnswer,
        provider: result.provider,
      });
    }

    const updatedRecent = userId
      ? await readRecentMemory(userId, 20)
      : [];

    return NextResponse.json({
      success: result.ok,
      data: {
        platform,
        mode,
        provider: result.provider,
        answer: cleanAnswer,
        suggestions: result.suggestions,
        quick_prompts: getQuickPromptsForMode(platform, mode),
        focus_areas: isSupaMindsChat ? [] : preset.focus_areas,
        recent_memory: updatedRecent,
        entitlement: usageGate ?? undefined,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    await supabase.from("ai_assistant_memory").delete().eq("user_id", userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Server error" }, { status: 500 });
  }
}
