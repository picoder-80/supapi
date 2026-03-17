import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { isOwnerTransferConfigured } from "@/lib/pi/payout";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.treasury.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const configured = isOwnerTransferConfigured();
  return NextResponse.json({
    success: true,
    data: {
      a2u_configured: configured,
      message: configured
        ? "Pi A2U payout aktif — Pi dihantar terus ke wallet penerima selepas bayaran."
        : "Pi A2U tidak dikonfigurasi. Set PI_PAYOUT_API_URL dan PI_PAYOUT_API_KEY dalam .env.",
    },
  });
}
