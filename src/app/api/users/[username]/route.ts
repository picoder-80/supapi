import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const supabase = await createAdminClient();

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, cover_url, bio, kyc_status, wallet_address, role, created_at")
      .eq("username", username)
      .single();

    if (error || !user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { user } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}