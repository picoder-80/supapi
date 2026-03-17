import { NextRequest, NextResponse } from "next/server";
import { approvePayment } from "@/lib/pi/payments";
import { getUserIdFromRequest } from "@/lib/supachat/server";

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { paymentId } = await req.json().catch(() => ({}));
  if (!paymentId) {
    return NextResponse.json({ success: false, error: "paymentId is required" }, { status: 400 });
  }

  const ok = await approvePayment(String(paymentId));
  if (!ok) {
    return NextResponse.json({ success: false, error: "Pi approval failed" }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
