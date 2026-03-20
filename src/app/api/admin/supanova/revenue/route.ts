import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/api/supanova/_shared";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const format = (searchParams.get("format") || "json").toLowerCase();

  const { data, error } = await supabase
    .from("arcade_revenue")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const rows = data ?? [];
  const totals = rows.reduce(
    (acc: any, r: any) => ({
      gross_sc: acc.gross_sc + Number(r.gross_sc ?? 0),
      platform_cut_sc: acc.platform_cut_sc + Number(r.platform_cut_sc ?? 0),
      prize_paid_sc: acc.prize_paid_sc + Number(r.prize_paid_sc ?? 0),
      net_sc: acc.net_sc + Number(r.net_sc ?? 0),
    }),
    { gross_sc: 0, platform_cut_sc: 0, prize_paid_sc: 0, net_sc: 0 }
  );

  if (format === "csv") {
    const header = "date,source,gross_sc,platform_cut_sc,prize_paid_sc,net_sc";
    const lines = rows.map((r: any) =>
      [r.date, r.source, Number(r.gross_sc ?? 0), Number(r.platform_cut_sc ?? 0), Number(r.prize_paid_sc ?? 0), Number(r.net_sc ?? 0)].join(",")
    );
    const csv = [header, ...lines].join("\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
  }

  return NextResponse.json({ success: true, rows, totals });
}
