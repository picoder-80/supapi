import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { approvePayment, completePayment } from "@/lib/pi/payments";
import { addMonths } from "@/lib/supaminds/subscription";

async function activateSubscription(args: {
  userId: string;
  planId: string;
  paidAtIso: string;
}) {
  const supabase = await createAdminClient();
  const { data: existing } = await supabase
    .from("mind_subscriptions")
    .select("id, current_period_end, status")
    .eq("user_id", args.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nowIso = args.paidAtIso;
  const startBase = existing?.current_period_end && new Date(existing.current_period_end).getTime() > Date.now()
    ? String(existing.current_period_end)
    : nowIso;
  const periodEnd = addMonths(startBase, 1);

  if (existing?.id) {
    await supabase
      .from("mind_subscriptions")
      .update({
        plan_id: args.planId,
        status: "active",
        cancel_at_period_end: false,
        started_at: existing.status === "active" ? undefined : nowIso,
        current_period_start: startBase,
        current_period_end: periodEnd,
        grace_until: null,
        canceled_at: null,
        updated_at: nowIso,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created } = await supabase
    .from("mind_subscriptions")
    .insert({
      user_id: args.userId,
      plan_id: args.planId,
      status: "active",
      cancel_at_period_end: false,
      started_at: nowIso,
      current_period_start: nowIso,
      current_period_end: periodEnd,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload?.userId) return NextResponse.json({ success: false }, { status: 401 });
    const supabase = await createAdminClient();

    const body = await req.json();
    const action = String(body?.action ?? "");
    const kind = String(body?.kind ?? "subscription").trim().toLowerCase();
    const packCode = String(body?.pack_code ?? "").trim();
    const invoiceId = String(body?.invoice_id ?? "");
    const paymentId = String(body?.paymentId ?? "");
    const txid = String(body?.txid ?? "");
    if (!invoiceId || !paymentId || !action) return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    if (!["subscription", "topup"].includes(kind)) return NextResponse.json({ success: false, error: "Invalid kind" }, { status: 400 });

    const { data: invoice } = await supabase
      .from("mind_invoices")
      .select("id, user_id, plan_id, status, quote_expires_at")
      .eq("id", invoiceId)
      .single();
    if (!invoice || String(invoice.user_id) !== payload.userId) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    if (action === "approve") {
      if (new Date(String(invoice.quote_expires_at)).getTime() < Date.now()) {
        await supabase.from("mind_invoices").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", invoice.id);
        return NextResponse.json({ success: false, error: "Quote expired. Please refresh quote." }, { status: 400 });
      }
      const ok = await approvePayment(paymentId);
      if (!ok) return NextResponse.json({ success: false, error: "Pi approve failed" }, { status: 502 });

      await supabase.from("mind_invoices").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", invoice.id);
      await supabase
        .from("mind_payments")
        .upsert(
          {
            invoice_id: invoice.id,
            provider: "pi",
            provider_payment_id: paymentId,
            status: "approved",
            raw_payload: { kind, pack_code: packCode || null },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "provider,provider_payment_id" }
        );
      return NextResponse.json({ success: true });
    }

    if (action === "complete") {
      if (!txid) return NextResponse.json({ success: false, error: "Missing txid" }, { status: 400 });
      const { data: existingPay } = await supabase
        .from("mind_payments")
        .select("id, status")
        .eq("provider", "pi")
        .eq("provider_payment_id", paymentId)
        .maybeSingle();
      if (existingPay?.status === "completed") {
        return NextResponse.json({ success: true, data: { already: true } });
      }

      const ok = await completePayment(paymentId, txid);
      if (!ok) {
        await supabase
          .from("mind_payments")
          .upsert(
            {
              invoice_id: invoice.id,
              provider: "pi",
              provider_payment_id: paymentId,
              txid,
              status: "failed",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "provider,provider_payment_id" }
          );
        return NextResponse.json({ success: false, error: "Pi complete failed" }, { status: 502 });
      }

      const nowIso = new Date().toISOString();
      await supabase.from("mind_invoices").update({ status: "paid", paid_at: nowIso, updated_at: nowIso }).eq("id", invoice.id);
      await supabase
        .from("mind_payments")
        .upsert(
          {
            invoice_id: invoice.id,
            provider: "pi",
            provider_payment_id: paymentId,
            txid,
            status: "completed",
            raw_payload: { kind, pack_code: packCode || null },
            updated_at: nowIso,
          },
          { onConflict: "provider,provider_payment_id" }
        );
      if (kind === "topup") {
        const { data: pack } = await supabase
          .from("mind_topup_packs")
          .select("id, prompts")
          .eq("code", packCode)
          .eq("active", true)
          .maybeSingle();
        if (!pack?.id) return NextResponse.json({ success: false, error: "Topup pack not found" }, { status: 400 });
        const prompts = Number(pack.prompts ?? 0);
        await supabase
          .from("mind_topup_ledger")
          .insert({
            user_id: payload.userId,
            pack_id: pack.id,
            invoice_id: invoice.id,
            status: "active",
            prompts_total: prompts,
            prompts_used: 0,
            prompts_remaining: prompts,
            updated_at: nowIso,
          });
        return NextResponse.json({ success: true, data: { topup_prompts: prompts } });
      }

      const subId = await activateSubscription({ userId: payload.userId, planId: String(invoice.plan_id), paidAtIso: nowIso });
      if (subId) {
        await supabase.from("mind_invoices").update({ subscription_id: subId, updated_at: nowIso }).eq("id", invoice.id);
      }
      return NextResponse.json({ success: true, data: { subscription_id: subId } });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
