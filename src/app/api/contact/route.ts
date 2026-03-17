import { NextRequest, NextResponse } from "next/server";
import { sendPlatformEmail } from "@/lib/email";

const SUPPORT_EMAIL = "support@supapi.app";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Rate limit: simple length check to prevent abuse
    if (message.length > 5000) {
      return NextResponse.json(
        { success: false, error: "Message is too long." },
        { status: 400 }
      );
    }

    const subjectLine = subject || "Contact form submission";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1A1A2E; padding: 24px; text-align: center;">
          <h2 style="color: #F5A623; margin: 0;">π Supapi — Contact Form</h2>
        </div>
        <div style="padding: 24px; border: 1px solid #E2E8F0; border-top: none;">
          <p style="margin: 0 0 12px;"><strong>From:</strong> ${escapeHtml(name)}</p>
          <p style="margin: 0 0 12px;"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          <p style="margin: 0 0 16px;"><strong>Subject:</strong> ${escapeHtml(subjectLine)}</p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
          <div style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</div>
        </div>
        <div style="padding: 16px 24px; color: #888; font-size: 12px; border: 1px solid #E2E8F0; border-top: none;">
          Sent via Supapi Contact Form
        </div>
      </div>
    `;

    const sent = await sendPlatformEmail({
      to: SUPPORT_EMAIL,
      subject: `[Contact] ${subjectLine} — from ${name}`,
      html,
      replyTo: email,
    });

    if (!sent) {
      return NextResponse.json(
        { success: false, error: "Failed to send message. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Message sent successfully." });
  } catch (err) {
    console.error("[Contact] Error:", err);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
