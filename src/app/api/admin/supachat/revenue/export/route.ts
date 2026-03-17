import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

function csvEscape(value: string | number | null | undefined) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, "\"\"")}"`;
  return str;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.treasury.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "all";

  let fromDate: string | null = null;
  if (period === "month") {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    fromDate = d.toISOString();
  } else if (period === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    fromDate = d.toISOString();
  }

  let query = supabase
    .from("supachat_revenue")
    .select("id,type,source_id,amount_pi,created_at")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (fromDate) query = query.gte("created_at", fromDate);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const headers = ["id", "type", "source_id", "amount_pi", "created_at"];
  const rows = (data ?? []).map((row: any) =>
    headers.map((key) => csvEscape(row[key as keyof typeof row])).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="supachat-revenue-${period}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
