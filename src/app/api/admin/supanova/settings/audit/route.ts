import { NextResponse } from "next/server";
import { supabase } from "@/app/api/supanova/_shared";

export async function GET() {
  const { data, error } = await supabase
    .from("arcade_commission_audit")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const userIds = [...new Set((data ?? []).map((r: any) => String(r.changed_by ?? "")).filter(Boolean))];
  const { data: users } = userIds.length
    ? await supabase.from("users").select("id,username,display_name").in("id", userIds)
    : { data: [] as any[] };
  const userMap = new Map((users ?? []).map((u: any) => [String(u.id), u]));

  return NextResponse.json({
    success: true,
    data: (data ?? []).map((r: any) => ({ ...r, admin: userMap.get(String(r.changed_by)) ?? null })),
  });
}
