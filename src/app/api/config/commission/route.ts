import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const KEYS = ["commission_supascrow", "supachat_transfer_commission_pct"] as const;
const DEFAULTS: Record<(typeof KEYS)[number], number> = {
  commission_supascrow: 5,
  supachat_transfer_commission_pct: 2,
};

export async function GET() {
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from("platform_config")
    .select("key, value")
    .in("key", KEYS);

  const map: Record<string, number> = {};
  for (const k of KEYS) map[k] = DEFAULTS[k];
  for (const row of data ?? []) {
    const v = parseFloat(String(row?.value ?? ""));
    if (!isNaN(v)) map[row.key as (typeof KEYS)[number]] = v;
  }
  return NextResponse.json({ success: true, data: map });
}
