// POST /api/live/payment — approve and complete live payment, then create Cloudflare stream
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { addDays } from "@/lib/live/payments";

async function createCloudflareStream(title: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Stream not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN.");
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meta: { name: title || "Supapi Live" },
        recording: { mode: "automatic", timeoutSeconds: 300 },
      }),
    }
  );

  const data = await res.json();
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? "Cloudflare Stream error");

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

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();
    const invoiceId = String(body?.invoice_id ?? "").trim();
    const paymentId = String(body?.paymentId ?? "").trim();
    const txid = String(body?.txid ?? "").trim();
    const title = String(body?.title ?? "").trim();
    const planCode = String(body?.plan_code ?? "").trim();

    const supabase = await createAdminClient();

    if (action === "approve") {
      const { data: invoice } = await supabase
        .from("live_invoices")
        .select("id, user_id, status")
        .eq("id", invoiceId)
        .eq("user_id", payload.userId)
        .maybeSingle();
      if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });

      await supabase.from("live_payments").upsert({
        invoice_id: invoiceId,
        provider: "pi",
        provider_payment_id: paymentId,
        status: "approved",
        raw_payload: { action: "approve" },
      }, { onConflict: "provider,provider_payment_id" });

      await supabase.from("live_invoices")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", invoiceId);

      return NextResponse.json({ success: true });
    }

    if (action === "complete") {
      const { data: invoice } = await supabase
        .from("live_invoices")
        .select("id, user_id, plan_id, status, amount_usd")
        .eq("id", invoiceId)
        .eq("user_id", payload.userId)
        .maybeSingle();
      if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });

      const nowIso = new Date().toISOString();

      // Mark payment complete
      await supabase.from("live_payments").upsert({
        invoice_id: invoiceId,
        provider: "pi",
        provider_payment_id: paymentId,
        txid,
        status: "completed",
        raw_payload: { action: "complete", txid },
      }, { onConflict: "provider,provider_payment_id" });

      await supabase.from("live_invoices")
        .update({ status: "paid", paid_at: nowIso, updated_at: nowIso })
        .eq("id", invoiceId);

      // If monthly plan, create subscription
      if (planCode === "live_monthly") {
        await supabase.from("live_subscriptions").upsert({
          user_id: payload.userId,
          plan_id: invoice.plan_id,
          status: "active",
          started_at: nowIso,
          current_period_start: nowIso,
          current_period_end: addDays(nowIso, 30),
          updated_at: nowIso,
        }, { onConflict: "user_id" });

        return NextResponse.json({ success: true, data: { plan_type: "monthly" } });
      }

      // For session plan — create Cloudflare stream
      const cf = await createCloudflareStream(title || "Supapi Live");

      // Create live session
      const { data: session, error: sessionErr } = await supabase
        .from("live_sessions")
        .insert({
          user_id: payload.userId,
          title: title || null,
          status: "live",
          plan_type: "session",
          invoice_id: invoiceId,
          cf_stream_id: cf.stream_id,
          cf_stream_key: cf.stream_key,
          cf_rtmps_url: cf.rtmps_url,
          cf_playback_url: cf.playback_url,
        })
        .select("id, cf_stream_key, cf_rtmps_url, cf_playback_url, cf_stream_id")
        .single();

      if (sessionErr || !session) {
        return NextResponse.json({ success: false, error: "Failed to create session" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: {
          plan_type: "session",
          session_id: session.id,
          stream_key: session.cf_stream_key,
          rtmps_url: session.cf_rtmps_url,
          playback_url: session.cf_playback_url,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[Live Payment]", err);
    return NextResponse.json({ success: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}
