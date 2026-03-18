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
      .select("id, username, display_name, avatar_url, cover_url, bio, kyc_status, wallet_address, wallet_verified, role, created_at, pi_uid")
      .eq("username", username)
      .single();

    if (error || !user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const { pi_uid, ...safeUser } = user as { pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } & typeof user;
    const hasPiUid = Boolean((pi_uid ?? "").trim());
    const hasActivatedWallet = Boolean((safeUser.wallet_address ?? "").trim()) || Boolean(safeUser.wallet_verified);
    const response = { ...safeUser, can_receive_pi: hasPiUid && hasActivatedWallet };
    return NextResponse.json({ success: true, data: { user: response } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}