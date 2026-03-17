import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

const TRANSFER_KEY = "supachat_transfer_commission_pct";
const ROOM_ENTRY_KEY = "supachat_room_entry_commission_pct";
const DEFAULT_TRANSFER = 2;
const DEFAULT_ROOM_ENTRY = 20;

// GET commission config + summary
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.supachat.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const [
    { data: transferConfig },
    { data: roomEntryConfig },
    { data: revenue },
    { data: roomEntryRevenue },
  ] = await Promise.all([
    supabase.from("platform_config").select("value").eq("key", TRANSFER_KEY).maybeSingle(),
    supabase.from("platform_config").select("value").eq("key", ROOM_ENTRY_KEY).maybeSingle(),
    supabase.from("supachat_revenue").select("amount_pi").eq("type", "transfer_commission"),
    supabase.from("supachat_revenue").select("amount_pi").eq("type", "room_entry"),
  ]);

  const totalTransferCommission = revenue?.reduce((s, r) => s + Number(r.amount_pi ?? 0), 0) ?? 0;
  const totalRoomEntryCommission = roomEntryRevenue?.reduce((s, r) => s + Number(r.amount_pi ?? 0), 0) ?? 0;

  return NextResponse.json({
    success: true,
    data: {
      commission_pct: parseFloat(transferConfig?.value ?? String(DEFAULT_TRANSFER)),
      total_commission_pi: totalTransferCommission,
      room_entry_commission_pct: parseFloat(roomEntryConfig?.value ?? String(DEFAULT_ROOM_ENTRY)),
      total_room_entry_commission_pi: totalRoomEntryCommission,
    },
  });
}

// PATCH — update commission % (transfer and/or room_entry)
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.supachat.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { commission_pct, room_entry_commission_pct } = body;

  const supabase = await createAdminClient();

  if (commission_pct !== undefined) {
    if (commission_pct < 0 || commission_pct > 50) {
      return NextResponse.json({ success: false, error: "Invalid transfer commission (0-50%)" }, { status: 400 });
    }
    const { error } = await supabase.from("platform_config").upsert(
      {
        key: TRANSFER_KEY,
        value: String(commission_pct),
        description: "SupaChat transfer commission % (DM tips, room tips, etc.)",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (room_entry_commission_pct !== undefined) {
    if (room_entry_commission_pct < 0 || room_entry_commission_pct > 50) {
      return NextResponse.json({ success: false, error: "Invalid room entry commission (0-50%)" }, { status: 400 });
    }
    const { error } = await supabase.from("platform_config").upsert(
      {
        key: ROOM_ENTRY_KEY,
        value: String(room_entry_commission_pct),
        description: "SupaChat paid room entry commission %",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      ...(commission_pct !== undefined && { commission_pct }),
      ...(room_entry_commission_pct !== undefined && { room_entry_commission_pct }),
    },
  });
}
