import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/security/audit";
import {
  getBlastProvider,
  getBlastProviderConfigStatus,
  sendEmailBlast,
  type BlastProviderPreference,
} from "@/lib/email/blast";

function htmlFromText(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  return `<div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; line-height: 1.6;">${escaped}</div>`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function fetchAllMatchedRecipientEmails(params: {
  q: string;
  includeUnverified: boolean;
  includeAllRoles: boolean;
  maxRows: number;
}): Promise<string[]> {
  const supabase = await createAdminClient();
  const batchSize = 5000;
  const recipients: string[] = [];
  let offset = 0;

  while (offset < params.maxRows) {
    let query = supabase
      .from("users")
      .select("email")
      .not("email", "is", null)
      .neq("email", "")
      .order("created_at", { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (!params.includeAllRoles) query = query.eq("role", "pioneer");
    if (!params.includeUnverified) query = query.eq("kyc_status", "verified");
    if (params.q) query = query.or(`username.ilike.%${params.q}%,email.ilike.%${params.q}%`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (!rows.length) break;

    for (const row of rows as any[]) {
      const email = String(row?.email ?? "").trim().toLowerCase();
      if (email) recipients.push(email);
    }

    if (rows.length < batchSize) break;
    offset += batchSize;
  }

  return [...new Set(recipients)];
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok || !auth.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.email_list.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const status = getBlastProviderConfigStatus();
  return NextResponse.json({
    success: true,
    data: {
      options: [
        { value: "auto", label: "Auto" },
        { value: "custom_api", label: "Custom API", configured: status.custom_api },
        { value: "resend", label: "Resend", configured: status.resend },
      ],
      active_provider: status.active_provider,
      custom_api_configured: status.custom_api,
      resend_configured: status.resend,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok || !auth.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.email_list.send")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const q = String(body?.q ?? "").trim();
    const includeUnverified = Boolean(body?.include_unverified);
    const includeAllRoles = Boolean(body?.include_all_roles);
    const dryRun = Boolean(body?.dry_run);
    const selectAllMatching = Boolean(body?.select_all_matching);
    const selectedEmailsInput = Array.isArray(body?.selected_emails) ? body.selected_emails : [];
    const selectedEmails = [
      ...new Set(
        selectedEmailsInput
          .map((e: unknown) => String(e ?? "").trim().toLowerCase())
          .filter((e: string) => isValidEmail(e)),
      ),
    ];
    const testEmailRaw = String(body?.test_email ?? "").trim().toLowerCase();
    const testEmail = testEmailRaw || null;
    const providerRaw = String(body?.provider ?? "auto").trim().toLowerCase();
    const providerPreference: BlastProviderPreference =
      providerRaw === "custom_api" || providerRaw === "resend" || providerRaw === "auto" ? providerRaw : "auto";
    const limitRaw = Number(body?.limit ?? 2000);
    const limit = Number.isFinite(limitRaw) ? Math.min(5000, Math.max(1, Math.floor(limitRaw))) : 2000;
    const subject = String(body?.subject ?? "").trim();
    const text = String(body?.text ?? "").trim();
    const htmlInput = String(body?.html ?? "").trim();

    if (!subject) return NextResponse.json({ success: false, error: "Subject is required" }, { status: 400 });
    if (!text) return NextResponse.json({ success: false, error: "Message body is required" }, { status: 400 });

    const supabase = await createAdminClient();
    let query = supabase
      .from("users")
      .select("id, email, username, kyc_status", { count: "exact" })
      .not("email", "is", null)
      .neq("email", "")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!includeAllRoles) query = query.eq("role", "pioneer");
    if (!includeUnverified) query = query.eq("kyc_status", "verified");
    if (q) query = query.or(`username.ilike.%${q}%,email.ilike.%${q}%`);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const recipientsPage = [...new Set((data ?? []).map((r: any) => String(r.email ?? "").trim().toLowerCase()).filter(Boolean))];
    const provider = getBlastProvider();
    const mode = testEmail ? "test" : "blast";

    if (testEmail && !isValidEmail(testEmail)) {
      return NextResponse.json({ success: false, error: "Invalid test email format" }, { status: 400 });
    }

    let finalRecipients = testEmail ? [testEmail] : recipientsPage;
    if (!testEmail && selectAllMatching) {
      finalRecipients = await fetchAllMatchedRecipientEmails({
        q,
        includeUnverified,
        includeAllRoles,
        maxRows: 200000,
      });
    } else if (!testEmail && selectedEmails.length > 0) {
      const selectedSet = new Set(selectedEmails);
      finalRecipients = recipientsPage.filter((e) => selectedSet.has(e));
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        data: {
          provider,
          provider_preference: providerPreference,
          dry_run: true,
          mode,
          recipients_count: finalRecipients.length,
          total_matched_count: Number(count ?? finalRecipients.length),
          select_all_matching: selectAllMatching,
          selected_count: selectedEmails.length,
          sample: finalRecipients.slice(0, 10),
          message: "Dry run complete. No emails sent.",
        },
      });
    }

    if (!finalRecipients.length) {
      return NextResponse.json({ success: false, error: "No recipients matched current filters" }, { status: 400 });
    }

    const html = htmlInput || htmlFromText(text);
    const textFallback = text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");
    const result = await sendEmailBlast({
      recipients: finalRecipients,
      subject,
      text: textFallback,
      html,
      meta: { source: "admin_email_list", mode, q, include_unverified: includeUnverified, test_email: testEmail },
    }, providerPreference);

    await logAdminAction({
      adminUserId: auth.userId,
      action: testEmail ? "email_blast_test_send" : "email_blast_send",
      targetType: "email_campaign",
      targetId: `blast_${Date.now()}`,
      detail: {
        mode,
        provider_preference: providerPreference,
        provider: result.provider,
        recipients_count: finalRecipients.length,
        total_matched_count: Number(count ?? finalRecipients.length),
        select_all_matching: selectAllMatching,
        selected_count: selectedEmails.length,
        sent_count: result.sent_count,
        failed_count: result.failed_count,
        include_unverified: includeUnverified,
        query: q,
        subject,
        test_email: testEmail,
      },
    });

    if (!result.ok) {
      return NextResponse.json({
        success: false,
        error: result.message ?? "Email blast failed",
        data: {
          provider: result.provider,
          sent_count: result.sent_count,
          failed_count: result.failed_count,
        },
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        mode,
        provider_preference: providerPreference,
        provider: result.provider,
        sent_count: result.sent_count,
        failed_count: result.failed_count,
        recipients_count: finalRecipients.length,
        total_matched_count: Number(count ?? finalRecipients.length),
        select_all_matching: selectAllMatching,
      },
      message: testEmail
        ? `Test sent: ${result.sent_count}/${finalRecipients.length}`
        : `Blast sent: ${result.sent_count}/${finalRecipients.length}`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Server error" }, { status: 500 });
  }
}
