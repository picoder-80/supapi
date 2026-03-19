// Public marketplace stats for hero (no auth)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const [
      { count: completedEscrowCount },
      { data: completedRows },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      supabase
        .from("orders")
        .select("amount_pi, price_pi")
        .eq("status", "completed"),
    ]);

    const totalPiTransactions = completedRows?.reduce((sum, o: {
      amount_pi: number | string | null;
      price_pi?: number | string | null;
    }) => {
      return sum + Number(o.amount_pi ?? o.price_pi ?? 0);
    }, 0) ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        delivered: completedEscrowCount ?? 0,
        total_pi_transactions: totalPiTransactions,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, {
      status: 500,
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  }
}
