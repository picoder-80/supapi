import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getAdmin(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const p = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return p.role === "admin" ? p : null;
  } catch { return null; }
}

export async function GET(req: Request) {
  if (!getAdmin(req)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "config") {
    const { data } = await supabase.from("platform_config").select("key,value,description")
      .like("key", "referral_%");
    return NextResponse.json({ success: true, data: data ?? [] });
  }

  if (type === "stats") {
    const [refs, earnings, earners] = await Promise.all([
      supabase.from("referrals").select("id", { count: "exact", head: true }),
      supabase.from("referral_earnings").select("earned_pi, status"),
      supabase.from("referral_stats").select("user_id", { count: "exact", head: true }).gt("total_referrals", 0),
    ]);
    const e = earnings.data ?? [];
    return NextResponse.json({ success: true, data: {
      total_referrals:   refs.count ?? 0,
      active_referrers:  earners.count ?? 0,
      total_earnings_pi: e.reduce((s, x) => s + parseFloat(String(x.earned_pi)), 0),
      pending_pi:        e.filter(x => x.status === "pending").reduce((s, x) => s + parseFloat(String(x.earned_pi)), 0),
      paid_pi:           e.filter(x => x.status === "paid").reduce((s, x) => s + parseFloat(String(x.earned_pi)), 0),
    }});
  }

  if (type === "earners") {
    const { data } = await supabase.from("referral_stats")
      .select("user_id, total_earned_pi, total_referrals, rank, users(username, avatar_url)")
      .order("total_earned_pi", { ascending: false })
      .limit(20);
    return NextResponse.json({ success: true, data: data ?? [] });
  }

  return NextResponse.json({ success: false, error: "Unknown type" }, { status: 400 });
}

// PATCH — update a single config key
export async function PATCH(req: Request) {
  if (!getAdmin(req)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { key, value } = await req.json();
  if (!key || value === undefined) return NextResponse.json({ success: false, error: "Missing key/value" }, { status: 400 });
  if (!key.startsWith("referral_")) return NextResponse.json({ success: false, error: "Invalid key" }, { status: 400 });

  const { error } = await supabase.from("platform_config")
    .update({ value: String(value) }).eq("key", key);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}