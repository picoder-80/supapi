// POST /api/live/start — start free session for monthly subscribers
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { hasActiveLiveSubscription } from "@/lib/live/payments";

async function createCloudflareStream(title: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!accountId || !apiToken) throw new Error("Cloudflare Stream not configured");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        meta: { name: title || "Supapi Live" },
        recording: { mode: "automatic", timeoutSeconds: 300 },
      }),
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? "Cloudflare error");

  const result = data.result;
  return {
    stream_id: result.uid,
    rtmps_url: result.rtmps?.url,
    stream_key: result.rtmps?.streamKey,
    playback_url: `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE ?? ""}.cloudflarestream.com/${result.uid}/manifest/video.m3u8`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload?.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminClient();

    const hasMonthly = await hasActiveLiveSubscription(supabase, payload.userId);
    if (!hasMonthly) {
      return NextResponse.json({ success: false, error: "No active monthly plan" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? "").trim();

    const cf = await createCloudflareStream(title || "Supapi Live");

    const { data: session, error } = await supabase
      .from("live_sessions")
      .insert({
        user_id: payload.userId,
        title: title || null,
        status: "live",
        plan_type: "monthly",
        cf_stream_id: cf.stream_id,
        cf_stream_key: cf.stream_key,
        cf_rtmps_url: cf.rtmps_url,
        cf_playback_url: cf.playback_url,
      })
      .select("id, cf_stream_key, cf_rtmps_url, cf_playback_url")
      .single();

    if (error || !session) return NextResponse.json({ success: false, error: "Failed to create session" }, { status: 500 });

    return NextResponse.json({
      success: true,
      data: {
        session_id: session.id,
        stream_key: session.cf_stream_key,
        rtmps_url: session.cf_rtmps_url,
        playback_url: session.cf_playback_url,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}
