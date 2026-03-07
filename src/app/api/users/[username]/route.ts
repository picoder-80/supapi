// app/api/users/[username]/route.ts — Public user profile

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const supabase = await createAdminClient();
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, kyc_status, role, created_at, referral_code")
      .eq("username", params.username)
      .single();

    if (error || !user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { user } });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}