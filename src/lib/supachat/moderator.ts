import { createHash } from "crypto";
import { getSupaChatAdminClient } from "@/lib/supachat/server";

type ModerationContext = { roomId?: string; conversationId?: string; groupId?: string };

type ModerationParsed = {
  safe: boolean;
  category?: string;
  confidence?: number;
  reason?: string;
};

type SanctionResult = {
  type: "muted" | "banned";
  reason: string;
  expires_at: string | null;
};

const MODEL = "claude-haiku-4-5-20251001";
const CONFIDENCE_THRESHOLD = 0.75;
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 2000;

const cache = new Map<string, { expiresAt: number; value: ModerationParsed }>();

function cacheKey(content: string) {
  return createHash("sha256").update(content.trim().toLowerCase()).digest("hex");
}

function parseClaudeJson(raw: string): ModerationParsed {
  const cleaned = raw.trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last < first) return { safe: true, confidence: 0 };
  const json = JSON.parse(cleaned.slice(first, last + 1));
  return {
    safe: Boolean(json.safe),
    category: json.category ? String(json.category) : undefined,
    confidence: Number(json.confidence ?? 0),
    reason: json.reason ? String(json.reason) : undefined,
  };
}

async function callClaudeModeration(content: string): Promise<ModerationParsed> {
  const key = cacheKey(content);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { safe: true, confidence: 0 };

  const prompt = `You are a strict chat moderation classifier.
Return ONLY valid JSON with this exact schema:
{"safe":boolean,"category":"string","confidence":number,"reason":"string"}

Rules:
- safe=false for: hate, harassment, threats, sexual content involving minors, explicit sexual solicitation, illegal activities, fraud/scams, self-harm encouragement, extremist/terror praise, doxxing/privacy leaks.
- safe=true for normal conversation, negotiation, marketplace discussion, and harmless slang.
- confidence must be between 0 and 1.
- category examples: harassment, hate, sexual, violence, fraud, self_harm, illegal, privacy, extremist, spam, other.
- reason short and objective.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 100,
        temperature: 0,
        system: prompt,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: `Moderate this message:\n${content}` }],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { safe: true, confidence: 0 };
    const json = await res.json();
    const text = String(json?.content?.[0]?.text ?? "");
    const parsed = parseClaudeJson(text);
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: parsed });
    return parsed;
  } catch {
    return { safe: true, confidence: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function getActiveSupaChatSanction(userId: string): Promise<SanctionResult | null> {
  const supabase = getSupaChatAdminClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("supachat_sanctions")
    .select("type,reason,expires_at,created_at")
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(5);
  const rows = data ?? [];
  const banned = rows.find((r: any) => r.type === "banned");
  if (banned) return { type: "banned", reason: String(banned.reason ?? "Policy violation"), expires_at: null };
  const muted = rows.find((r: any) => r.type === "muted");
  if (muted) {
    return {
      type: "muted",
      reason: String(muted.reason ?? "Policy violation"),
      expires_at: muted.expires_at ? String(muted.expires_at) : null,
    };
  }
  return null;
}

function getStrikeSanction(strikeNumber: number) {
  if (strikeNumber <= 1) return { action: "auto_deleted", sanction: "deleted_only" as const, muteHours: 0 };
  if (strikeNumber === 2) return { action: "user_muted", sanction: "muted_1h" as const, muteHours: 1 };
  if (strikeNumber === 3) return { action: "user_muted", sanction: "muted_24h" as const, muteHours: 24 };
  return { action: "user_banned", sanction: "banned" as const, muteHours: 0 };
}

export async function moderateMessage(
  content: string,
  userId: string,
  context: ModerationContext
): Promise<{ allowed: boolean; category?: string; reason?: string; sanction?: string }> {
  const supabase = getSupaChatAdminClient();
  const nowIso = new Date().toISOString();
  const trimmed = content.trim();
  if (!trimmed) return { allowed: true };

  const ai = await callClaudeModeration(trimmed);
  const safeByConfidence = ai.safe || Number(ai.confidence ?? 0) <= CONFIDENCE_THRESHOLD;

  if (safeByConfidence) {
    await supabase.from("supachat_moderation_logs").insert({
      user_id: userId,
      room_id: context.roomId ?? null,
      conversation_id: context.conversationId ?? null,
      group_id: context.groupId ?? null,
      message_content: trimmed.slice(0, 4000),
      violation_category: ai.safe ? "safe" : ai.category ?? "low_confidence",
      confidence: Number(ai.confidence ?? 0),
      action_taken: ai.safe ? "allowed" : "allowed_low_confidence",
      reasoning: ai.reason ?? null,
      created_at: nowIso,
    });
    return { allowed: true };
  }

  // Idempotency guard: repeated identical violation in a very short window.
  const { data: recentSame } = await supabase
    .from("supachat_moderation_logs")
    .select("id,action_taken,violation_category")
    .eq("user_id", userId)
    .eq("message_content", trimmed.slice(0, 4000))
    .eq("room_id", context.roomId ?? null)
    .eq("conversation_id", context.conversationId ?? null)
    .eq("group_id", context.groupId ?? null)
    .gte("created_at", new Date(Date.now() - 30_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentSame?.id) {
    return {
      allowed: false,
      category: ai.category ?? recentSame.violation_category ?? "other",
      sanction: recentSame.action_taken ?? "auto_deleted",
    };
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("supachat_strikes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  const strikeNumber = Number(count ?? 0) + 1;
  const sanctionPlan = getStrikeSanction(strikeNumber);

  await supabase.from("supachat_strikes").insert({
    user_id: userId,
    reason: ai.reason ?? "Moderation policy violation",
    violation_category: ai.category ?? "other",
    created_at: nowIso,
  });

  let sanction = sanctionPlan.sanction;
  if (sanctionPlan.sanction === "banned") {
    const active = await getActiveSupaChatSanction(userId);
    if (!active || active.type !== "banned") {
      await supabase.from("supachat_sanctions").insert({
        user_id: userId,
        type: "banned",
        reason: ai.category ?? "policy_violation",
        expires_at: null,
        created_at: nowIso,
      });
    }
  } else if (sanctionPlan.muteHours > 0) {
    const muteUntil = new Date(Date.now() + sanctionPlan.muteHours * 60 * 60 * 1000).toISOString();
    const active = await getActiveSupaChatSanction(userId);
    if (active?.type !== "banned") {
      if (!active || !active.expires_at || active.expires_at < muteUntil) {
        await supabase.from("supachat_sanctions").insert({
          user_id: userId,
          type: "muted",
          reason: ai.category ?? "policy_violation",
          expires_at: muteUntil,
          created_at: nowIso,
        });
      }
    } else {
      sanction = "banned";
    }
  }

  await supabase.from("supachat_moderation_logs").insert({
    user_id: userId,
    room_id: context.roomId ?? null,
    conversation_id: context.conversationId ?? null,
    group_id: context.groupId ?? null,
    message_content: trimmed.slice(0, 4000),
    violation_category: ai.category ?? "other",
    confidence: Number(ai.confidence ?? 0),
    action_taken: sanctionPlan.action,
    reasoning: ai.reason ?? null,
    created_at: nowIso,
  });

  return {
    allowed: false,
    category: ai.category ?? "other",
    reason: ai.reason ?? undefined,
    sanction,
  };
}
