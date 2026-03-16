// Public marketplace stats for hero (no auth)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Orders with Pi still in escrow (not yet released/completed/refunded/cancelled)
const ESCROW_STATUSES = ["paid", "shipped", "meetup_set", "delivered"];

export async function GET() {
  try {
    const [
      { count: deliveredCount },
      { data: escrowRows },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["delivered", "completed"]),
      supabase
        .from("orders")
        .select("amount_pi")
        .in("status", ESCROW_STATUSES),
    ]);

    const escrowPi = escrowRows?.reduce((sum, o) => sum + Number(o.amount_pi ?? 0), 0) ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        delivered: deliveredCount ?? 0,
        escrow_pi: escrowPi,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
