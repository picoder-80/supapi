import { NextRequest, NextResponse } from "next/server";
import { completePayment } from "@/lib/pi/payments";
import { getUserIdFromRequest } from "@/lib/supachat/server";

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { paymentId, txid } = await req.json().catch(() => ({}));
  if (!paymentId || !txid) {
    return NextResponse.json({ success: false, error: "paymentId and txid are required" }, { status: 400 });
  }

  const ok = await completePayment(String(paymentId), String(txid));
  if (!ok) {
    return NextResponse.json({ success: false, error: "Pi completion failed" }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
