import { NextRequest, NextResponse } from "next/server";
import { getSupaChatAdminClient, getUserIdFromRequest } from "@/lib/supachat/server";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const supabase = getSupaChatAdminClient();

  const { data } = await supabase
    .from("supachat_verified_badges")
    .select("id,user_id,expires_at,amount_pi,created_at")
    .eq("user_id", userId)
    .maybeSingle();
  const active = Boolean(data?.expires_at && new Date(data.expires_at).getTime() > Date.now());
  if (data?.expires_at) {
    const msLeft = new Date(data.expires_at).getTime() - Date.now();
    const daysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000));
    if (daysLeft >= 0 && daysLeft <= 3) {
      await supabase.from("notifications").upsert(
        {
          user_id: userId,
          title: "Verified badge expiring soon",
          message: "⚠️ Your verified badge expires in 3 days. Renew for π5.",
          link: "/supachat",
          type: "supachat_badge_expiry",
          dedupe_key: `supachat-badge-expiry-${userId}-${new Date().toISOString().slice(0, 10)}`,
          metadata: { expires_at: data.expires_at },
        },
        { onConflict: "dedupe_key" }
      );
    }
  }
  return NextResponse.json({ success: true, data: data ?? null, active });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const supabase = getSupaChatAdminClient();
  const amountPi = Number(body.amountPi ?? 5);
  const startAt = new Date();
  const baseTime = body.extend_from_now
    ? startAt
    : new Date(startAt.getTime() - 1000);
  const expiresAt = new Date(baseTime.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("supachat_verified_badges")
    .upsert(
      {
        user_id: userId,
        expires_at: expiresAt,
        amount_pi: amountPi,
        pi_payment_id: body.pi_payment_id ?? null,
        txid: body.txid ?? null,
      },
      { onConflict: "user_id" }
    )
    .select("id,user_id,expires_at,amount_pi,created_at")
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from("supachat_revenue").insert({
    type: "badge",
    source_id: data.id,
    amount_pi: amountPi,
  });
  await supabase.from("notifications").upsert(
    {
      user_id: userId,
      title: "Verified badge active",
      message: "✅ Your SupaChat verified badge is active for 30 days.",
      link: "/supachat",
      type: "supachat_badge",
      dedupe_key: `supachat-badge-purchase-${data.id}`,
      metadata: { expires_at: data.expires_at },
    },
    { onConflict: "dedupe_key" }
  );

  return NextResponse.json({ success: true, data, active: true });
}
