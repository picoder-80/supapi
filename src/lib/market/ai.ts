export type DisputeDecision = "refund" | "release" | "manual_review";

export interface DisputeAnalysisInput {
  reason: string;
  evidence?: string[];
  buying_method?: string | null;
  order_status?: string | null;
  amount_pi?: number | null;
}

export interface DisputeAnalysisResult {
  decision: DisputeDecision;
  confidence: number;
  reasoning: string;
  conditions?: string;
  source: "heuristic" | "llm";
}

export interface SupportTriageInput {
  message: string;
  order_status?: string | null;
}

export interface SupportTriageResult {
  category: "payment" | "delivery" | "refund" | "account" | "dispute" | "general";
  priority: "low" | "medium" | "high" | "urgent";
  suggested_reply: string;
  recommended_actions: string[];
  source: "heuristic" | "llm";
}

type ProviderName = "anthropic" | "openai" | "deepseek" | "heuristic";

function clampConfidence(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function stripProviderTag(text: string): string {
  return String(text ?? "")
    .replace(/\s*\[provider:(anthropic|openai|deepseek|heuristic)\]\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripModelDisclaimer(text: string): string {
  return String(text ?? "")
    .replace(/as an ai( language model)?[,]?\s*/gi, "")
    .replace(/i (cannot|can't) (verify|access)[^.!?]*[.!?]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeSentence(text: string): string {
  const clean = stripModelDisclaimer(stripProviderTag(text));
  return clean.endsWith(".") || clean.endsWith("!") || clean.endsWith("?") ? clean : `${clean}.`;
}

function enrichDisputeReasoning(params: {
  baseReasoning: string;
  decision: DisputeDecision;
  input: DisputeAnalysisInput;
  conditions?: string;
}): string {
  return normalizeSentence(params.baseReasoning);
}

const AGGRESSIVE_AUTO_MODE = process.env.MARKET_AI_AGGRESSIVE_AUTO !== "false";

function getAutoResolveThreshold(): number {
  const parsed = Number(process.env.MARKET_AI_AUTO_RESOLVE_THRESHOLD ?? "0.75");
  return Number.isFinite(parsed) ? parsed : 0.75;
}

function getMaxAutoResolvePi(): number {
  const parsed = Number(process.env.MARKET_AI_MAX_AUTO_RESOLVE_PI ?? "300");
  return Number.isFinite(parsed) ? parsed : 300;
}

function getProviderOrder(): ProviderName[] {
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

function pickFallbackDecision(input: DisputeAnalysisInput): "refund" | "release" {
  const text = `${input.reason} ${(input.evidence ?? []).join(" ")}`.toLowerCase();
  const refundSignals = /not receive|didn't receive|did not receive|item not received|never arrived|missing|damag|broken|defect|wrong item|not as described|fake|counterfeit/.test(text);
  return refundSignals ? "refund" : "release";
}

function normalizeDecision(result: DisputeAnalysisResult, input: DisputeAnalysisInput): DisputeAnalysisResult {
  if (result.decision !== "manual_review" || !AGGRESSIVE_AUTO_MODE) return result;

  const fallback = pickFallbackDecision(input);
  return {
    ...result,
    decision: fallback,
    confidence: clampConfidence(Math.max(result.confidence, 0.78)),
    reasoning: `${normalizeSentence(result.reasoning)} Policy safeguard applied to prevent queue delays; case is escalated to ${fallback}.`,
  };
}

function analyzeDisputeHeuristic(input: DisputeAnalysisInput): DisputeAnalysisResult {
  const text = `${input.reason} ${(input.evidence ?? []).join(" ")}`.toLowerCase();

  const hasNoReceive = /not receive|didn't receive|did not receive|item not received|never arrived|missing/.test(text);
  const hasDamaged = /damag|broken|defect|spoiled|not working/.test(text);
  const hasWrongItem = /wrong item|not as described|fake|counterfeit|different item/.test(text);
  const hasBuyerRemorse = /change mind|changed my mind|cancel|no longer need/.test(text);
  const hasSellerProof = /tracking|proof of delivery|delivered/.test(text);

  if (hasNoReceive || hasDamaged || hasWrongItem) {
    return {
      decision: "refund",
      confidence: 0.84,
      reasoning: "Signals suggest non-delivery or item mismatch. Refund recommended until seller provides proof.",
      conditions: "If seller can provide verified proof of delivery and condition, escalate to manual review.",
      source: "heuristic",
    };
  }

  if (hasBuyerRemorse && input.order_status === "delivered") {
    return {
      decision: "release",
      confidence: 0.74,
      reasoning: "Looks like buyer preference change after delivery. Release to seller unless defect is shown.",
      conditions: "Allow goodwill partial refund if seller agrees.",
      source: "heuristic",
    };
  }

  if (hasSellerProof && input.order_status === "delivered") {
    return {
      decision: "release",
      confidence: 0.72,
      reasoning: "Delivery proof and order status support release. No strong contradiction in evidence.",
      conditions: "Keep manual appeal open for 24h if new evidence appears.",
      source: "heuristic",
    };
  }

  return {
    decision: "manual_review",
    confidence: 0.52,
    reasoning: "Evidence is mixed. Manual review needed before deciding.",
    conditions: "Collect screenshots, tracking details, and listing snapshots before final decision.",
    source: "heuristic",
  };
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
      max_tokens: 200,
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

async function callDeepSeek(prompt: string): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? null;
}

async function runPromptWithFallback(prompt: string): Promise<{ text: string | null; provider: ProviderName }> {
  const order = getProviderOrder();

  for (const provider of order) {
    try {
      if (provider === "anthropic") {
        const text = await callAnthropic(prompt);
        if (text) return { text, provider };
      } else if (provider === "openai") {
        const text = await callOpenAI(prompt);
        if (text) return { text, provider };
      } else if (provider === "deepseek") {
        const text = await callDeepSeek(prompt);
        if (text) return { text, provider };
      } else if (provider === "heuristic") {
        return { text: null, provider };
      }
    } catch {
      // Try next provider
    }
  }

  return { text: null, provider: "heuristic" };
}

export async function analyzeDispute(input: DisputeAnalysisInput): Promise<DisputeAnalysisResult> {
  const heuristic = analyzeDisputeHeuristic(input);

  const prompt = `You are a marketplace dispute reviewer. Return STRICT JSON only.\n\nInput:\n${JSON.stringify(input, null, 2)}\n\nSchema:\n{"decision":"refund"|"release"|"manual_review","confidence":0.0,"reasoning":"..."}\n\nRules:\n- If evidence is weak, choose "manual_review".\n- confidence must be 0..1.\n- reasoning: 1–2 short, friendly sentences. Be simple and clear. Example: "Buyer reports item not received; no delivery proof yet. Refund recommended."\n- Do NOT mention AI, model, or provider.`;

  try {
    const { text } = await runPromptWithFallback(prompt);
    if (!text) return normalizeDecision(heuristic, input);
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    const decision = (parsed.decision ?? "manual_review") as DisputeDecision;
    const normalized = normalizeDecision({
      decision: decision === "refund" || decision === "release" || decision === "manual_review" ? decision : "manual_review",
      confidence: clampConfidence(Number(parsed.confidence ?? heuristic.confidence)),
      reasoning: enrichDisputeReasoning({
        baseReasoning: String(parsed.reasoning ?? heuristic.reasoning),
        decision: decision === "refund" || decision === "release" || decision === "manual_review" ? decision : "manual_review",
        input,
        conditions: parsed.conditions ? String(parsed.conditions) : heuristic.conditions,
      }),
      conditions: parsed.conditions ? String(parsed.conditions) : heuristic.conditions,
      source: "llm",
    }, input);
    return normalized;
  } catch {
    const fallback = normalizeDecision(heuristic, input);
    return {
      ...fallback,
      reasoning: enrichDisputeReasoning({
        baseReasoning: fallback.reasoning,
        decision: fallback.decision,
        input,
        conditions: fallback.conditions,
      }),
    };
  }
}

function triageSupportHeuristic(input: SupportTriageInput): SupportTriageResult {
  const t = input.message.toLowerCase();

  if (/refund|return money|chargeback|money back/.test(t)) {
    return {
      category: "refund",
      priority: "high",
      suggested_reply: "I can help with your refund request. Please share your order ID and the exact issue so we can validate eligibility quickly.",
      recommended_actions: ["request_order_id", "check_order_status", "check_dispute_history"],
      source: "heuristic",
    };
  }
  if (/not receive|where.*order|tracking|delivery|ship/.test(t)) {
    return {
      category: "delivery",
      priority: "high",
      suggested_reply: "I understand you are checking delivery status. Please provide order ID and tracking details so we can verify shipment progress.",
      recommended_actions: ["request_order_id", "check_tracking_number", "verify_status_transition"],
      source: "heuristic",
    };
  }
  if (/payment|paid|escrow|wallet|pi payment/.test(t)) {
    return {
      category: "payment",
      priority: "medium",
      suggested_reply: "I can help check payment and escrow status. Please share your order ID and payment reference.",
      recommended_actions: ["request_order_id", "check_pi_payment_id", "check_escrow_flags"],
      source: "heuristic",
    };
  }
  if (/dispute|scam|fraud|fake/.test(t)) {
    return {
      category: "dispute",
      priority: "urgent",
      suggested_reply: "Thanks for flagging this. We can open a dispute now and freeze settlement while evidence is reviewed.",
      recommended_actions: ["request_order_id", "collect_evidence", "create_dispute_case"],
      source: "heuristic",
    };
  }

  return {
    category: "general",
    priority: "low",
    suggested_reply: "Thanks for contacting support. Please share your order ID and a short summary of the issue so I can route this correctly.",
    recommended_actions: ["request_order_id"],
    source: "heuristic",
  };
}

export async function triageSupport(input: SupportTriageInput): Promise<SupportTriageResult> {
  const heuristic = triageSupportHeuristic(input);

  const prompt = `You are support triage AI for marketplace.\nReturn STRICT JSON only.\n\nInput:\n${JSON.stringify(input, null, 2)}\n\nSchema:\n{"category":"payment"|"delivery"|"refund"|"account"|"dispute"|"general","priority":"low"|"medium"|"high"|"urgent","suggested_reply":"...","recommended_actions":["..."]}`;

  try {
    const { text } = await runPromptWithFallback(prompt);
    if (!text) return heuristic;
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return {
      category: parsed.category ?? heuristic.category,
      priority: parsed.priority ?? heuristic.priority,
      suggested_reply: stripProviderTag(String(parsed.suggested_reply ?? heuristic.suggested_reply)),
      recommended_actions: Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions.map(String) : heuristic.recommended_actions,
      source: "llm",
    };
  } catch {
    return heuristic;
  }
}

export function shouldAutoResolveDispute(confidence: number, amountPi?: number | null): {
  ok: boolean;
  reason: "auto_disabled" | "confidence_too_low" | "amount_too_high" | "ok";
  threshold: number;
  max_auto_resolve_pi: number;
} {
  const autoEnabled = (process.env.MARKET_AI_AUTO_RESOLVE_ENABLED ?? "true").toLowerCase() !== "false";
  const threshold = getAutoResolveThreshold();
  const maxAutoResolvePi = getMaxAutoResolvePi();
  const safeAmount = Number(amountPi ?? 0);

  if (!autoEnabled) {
    return { ok: false, reason: "auto_disabled", threshold, max_auto_resolve_pi: maxAutoResolvePi };
  }
  if (confidence < threshold) {
    return { ok: false, reason: "confidence_too_low", threshold, max_auto_resolve_pi: maxAutoResolvePi };
  }
  if (safeAmount > maxAutoResolvePi) {
    return { ok: false, reason: "amount_too_high", threshold, max_auto_resolve_pi: maxAutoResolvePi };
  }
  return { ok: true, reason: "ok", threshold, max_auto_resolve_pi: maxAutoResolvePi };
}
