// lib/email.ts

import { Resend } from "resend";

// Lazy init — only create client when actually sending
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

const FROM = () =>
  `${process.env.RESEND_FROM_NAME ?? "Supapi"} <${process.env.RESEND_FROM_EMAIL ?? "noreply@supapi.app"}>`;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailOptions) {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: FROM(),
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[Email] Send failed:", error);
      return false;
    }

    console.log("[Email] Sent:", data?.id);
    return true;
  } catch (err) {
    console.error("[Email] Error:", err);
    return false;
  }
}

export async function sendWelcomeEmail(email: string, username: string) {
  return sendEmail({
    to: email,
    subject: `Welcome to Supapi, ${username}! 🎉`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1A1A2E; padding: 32px; text-align: center;">
          <h1 style="color: #F5A623; font-size: 40px; margin: 0;">π Supapi</h1>
        </div>
        <div style="padding: 32px;">
          <h2>Welcome, ${username}! 👋</h2>
          <p>Your Supapi account has been successfully created.</p>
          <p>Start exploring our platform:</p>
          <ul>
            <li>🛍️ <strong>SupaMarket</strong> — Buy & sell items</li>
            <li>💼 <strong>SupaSkil</strong> — Offer your services</li>
            <li>📚 <strong>SupaDemy</strong> — Learn & earn</li>
            <li>🎮 <strong>SupaNova</strong> — Play & win Pi</li>
          </ul>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}"
             style="display: inline-block; background: #F5A623; color: #1A1A2E;
                    padding: 12px 24px; border-radius: 8px; text-decoration: none;
                    font-weight: bold; margin-top: 16px;">
            Open Supapi
          </a>
        </div>
        <div style="padding: 16px 32px; color: #888; font-size: 12px; border-top: 1px solid #eee;">
          © 2025 Supapi. All rights reserved.
        </div>
      </div>
    `,
  });
}

export async function sendOrderNotification(
  email: string,
  username: string,
  orderType: "new" | "completed" | "delivered",
  orderId: string
) {
  const subjects = {
    new:       "New order received! 📦",
    completed: "Your order is complete ✅",
    delivered: "Work delivered — please review 👀",
  };

  const messages = {
    new:       "You have a new order. Please accept and start working.",
    completed: "The buyer has confirmed receipt. Pi has been credited.",
    delivered: "The freelancer has delivered. Please review and confirm.",
  };

  return sendEmail({
    to: email,
    subject: subjects[orderType],
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1A1A2E; padding: 24px; text-align: center;">
          <h2 style="color: #F5A623; margin: 0;">π Supapi</h2>
        </div>
        <div style="padding: 32px;">
          <p>Hi ${username},</p>
          <p>${messages[orderType]}</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/wallet/orders/${orderId}"
             style="display: inline-block; background: #0F3460; color: white;
                    padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View Order
          </a>
        </div>
      </div>
    `,
  });
}

export async function sendReferralRewardEmail(
  email: string,
  username: string,
  rewardPi: number
) {
  return sendEmail({
    to: email,
    subject: `You earned ${rewardPi} Pi in referral rewards! 🎉`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1A1A2E; padding: 24px; text-align: center;">
          <h2 style="color: #F5A623; margin: 0;">π Supapi</h2>
        </div>
        <div style="padding: 32px; text-align: center;">
          <h2>🎊 Referral Reward!</h2>
          <p>Hi ${username},</p>
          <p>Someone you referred just made their first transaction!</p>
          <div style="background: #F0F4FF; padding: 24px; border-radius: 12px; margin: 24px 0;">
            <p style="font-size: 14px; color: #666; margin: 0;">Your reward</p>
            <p style="font-size: 48px; font-weight: bold; color: #F5A623; margin: 8px 0;">
              π ${rewardPi}
            </p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/wallet"
             style="display: inline-block; background: #27AE60; color: white;
                    padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View Wallet
          </a>
        </div>
        <div style="padding: 16px 32px; color: #888; font-size: 12px; border-top: 1px solid #eee;">
          © 2025 Supapi. All rights reserved.
        </div>
      </div>
    `,
  });
}