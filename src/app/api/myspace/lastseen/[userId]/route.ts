import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = await createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("id, last_seen")
      .eq("id", userId)
      .single();

    if (!data) return NextResponse.json({ success: false }, { status: 404 });
    return NextResponse.json({ success: true, data: { last_seen: data.last_seen } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}