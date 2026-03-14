import { Resend } from "resend";

type BlastInput = {
  recipients: string[];
  subject: string;
  html: string;
  text?: string;
  meta?: Record<string, unknown>;
};

export type BlastProvider = "custom_api" | "resend" | "unconfigured";
export type BlastProviderPreference = "auto" | "custom_api" | "resend";

type BlastResult = {
  ok: boolean;
  provider: BlastProvider;
  sent_count: number;
  failed_count: number;
  message?: string;
  raw?: unknown;
};

function chunk<T>(arr: T[], size: number): T[][];
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function resendFrom() {
  const fromName = process.env.RESEND_FROM_NAME ?? "Supapi";
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@supapi.app";
  return `${fromName} <${fromEmail}>`;
}

export function getBlastProvider(): "custom_api" | "resend" | "unconfigured" {
  if (process.env.EMAIL_BLASTER_API_URL && process.env.EMAIL_BLASTER_API_KEY) return "custom_api";
  if (process.env.RESEND_API_KEY) return "resend";
  return "unconfigured";
}

export function getBlastProviderConfigStatus() {
  const customConfigured = Boolean(process.env.EMAIL_BLASTER_API_URL && process.env.EMAIL_BLASTER_API_KEY);
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);
  return {
    custom_api: customConfigured,
    resend: resendConfigured,
    active_provider: getBlastProvider(),
  };
}

function resolveRequestedProvider(preference: BlastProviderPreference): BlastProvider {
  if (preference === "custom_api") {
    return process.env.EMAIL_BLASTER_API_URL && process.env.EMAIL_BLASTER_API_KEY ? "custom_api" : "unconfigured";
  }
  if (preference === "resend") return process.env.RESEND_API_KEY ? "resend" : "unconfigured";
  return getBlastProvider();
}

export async function sendEmailBlast(
  input: BlastInput,
  preference: BlastProviderPreference = "auto",
): Promise<BlastResult> {
  const recipients = [...new Set(input.recipients.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) {
    return {
      ok: false,
      provider: resolveRequestedProvider(preference),
      sent_count: 0,
      failed_count: 0,
      message: "No recipients",
    };
  }

  const provider = resolveRequestedProvider(preference);
  if (provider === "custom_api") {
    const customApiUrl = process.env.EMAIL_BLASTER_API_URL;
    const customApiKey = process.env.EMAIL_BLASTER_API_KEY;
    if (!customApiUrl || !customApiKey) {
      return {
        ok: false,
        provider: "unconfigured",
        sent_count: 0,
        failed_count: recipients.length,
        message: "Custom API is not configured (missing EMAIL_BLASTER_API_URL/API_KEY)",
      };
    }

    let sent = 0;
    let failed = 0;
    const raws: unknown[] = [];
    for (const batch of chunk(recipients, 1000)) {
      try {
        const response = await fetch(customApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${customApiKey}`,
          },
          body: JSON.stringify({
            recipients: batch,
            subject: input.subject,
            html: input.html,
            text: input.text ?? "",
            meta: input.meta ?? {},
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          failed += batch.length;
          raws.push(payload);
          continue;
        }
        const sentCount = Number((payload as any)?.sent_count ?? (payload as any)?.sent ?? batch.length);
        const normalizedSent = Number.isFinite(sentCount) ? Math.max(0, Math.min(batch.length, sentCount)) : batch.length;
        sent += normalizedSent;
        failed += batch.length - normalizedSent;
        raws.push(payload);
      } catch (error: any) {
        failed += batch.length;
        raws.push({ error: error?.message ?? "Custom email blaster request failed" });
      }
    }
    return {
      ok: failed === 0,
      provider: "custom_api",
      sent_count: sent,
      failed_count: failed,
      message: failed ? "Some custom API batches failed" : undefined,
      raw: raws,
    };
  }

  if (provider === "resend") {
    const resend = getResend();
    if (!resend) {
      return {
        ok: false,
        provider: "unconfigured",
        sent_count: 0,
        failed_count: recipients.length,
        message: "Resend is not configured (missing RESEND_API_KEY)",
      };
    }

    let sent = 0;
    let failed = 0;
    const raws: unknown[] = [];
    for (const batch of chunk(recipients, 50)) {
      try {
        const { data, error } = await resend.emails.send({
          from: resendFrom(),
          to: batch,
          subject: input.subject,
          html: input.html,
          text: input.text,
        });
        if (error) {
          failed += batch.length;
          raws.push(error);
        } else {
          sent += batch.length;
          raws.push(data ?? null);
        }
      } catch (error: any) {
        failed += batch.length;
        raws.push({ error: error?.message ?? "Resend batch failed" });
      }
    }

    return {
      ok: failed === 0,
      provider: "resend",
      sent_count: sent,
      failed_count: failed,
      message: failed ? "Some batches failed" : undefined,
      raw: raws,
    };
  }

  return {
    ok: false,
    provider: "unconfigured",
    sent_count: 0,
    failed_count: recipients.length,
    message:
      preference === "custom_api"
        ? "Custom API is not configured (missing EMAIL_BLASTER_API_URL/API_KEY)"
        : preference === "resend"
          ? "Resend is not configured (missing RESEND_API_KEY)"
          : "Configure EMAIL_BLASTER_API_URL/API_KEY or RESEND_API_KEY",
  };
}
