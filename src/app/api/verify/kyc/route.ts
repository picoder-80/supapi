// src/app/api/verify/kyc/route.ts
// POST — self-declare KYC Pioneer badge

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json();

  if (action === "self_declare") {
    // Upsert KYC record
    const { error } = await supabase
      .from("kyc_verifications")
      .upsert({
        user_id:       userId,
        self_declared: true,
        badge_level:   "kyc_pioneer",
        verified_at:   new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      console.error("[verify/kyc]", error);
      return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
    }

    // Update users table
    await supabase
      .from("users")
      .update({ kyc_self_declared: true })
      .eq("id", userId);

    return NextResponse.json({ success: true, badge: "kyc_pioneer" });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
