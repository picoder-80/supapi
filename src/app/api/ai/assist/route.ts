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

async function readRecentMemory(userId: string, limit = 20): Promise<MemoryRow[]> {
  try {
    const { data, error } = await supabase
      .from("ai_assistant_memory")
      .select("platform, mode, question, answer, provider, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as MemoryRow[];
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
      answer: params.answer,
      provider: params.provider,
      metadata: {},
    });
  } catch {
    // ignore DB write failure
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

    if (!message) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }
    if (message.length > 1200) {
      return NextResponse.json({ success: false, error: "Message too long" }, { status: 400 });
    }

    const recentMemory = userId
      ? await readRecentMemory(userId, 5)
      : [];
    const memoryContext = recentMemory.length
      ? recentMemory
          .map((m, idx) => `#${idx + 1} [${m.platform}/${m.mode}] Q:${m.question}\nA:${m.answer}`)
          .join("\n\n")
      : "none";

    const mergedContext = `${clientContext}\nserver_recent_memory:\n${memoryContext}`.trim();
    const result = await runPlatformAssistant({ platform, mode, message, context: mergedContext });
    const preset = getPlatformAIPreset(platform);

    if (userId && result.ok && result.answer) {
      await writeMemory({
        userId,
        platform,
        mode,
        question: message,
        answer: result.answer,
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
        answer: result.answer,
        suggestions: result.suggestions,
        quick_prompts: getQuickPromptsForMode(platform, mode),
        focus_areas: preset.focus_areas,
        recent_memory: updatedRecent,
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
