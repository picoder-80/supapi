import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupasifiedsMonetizationConfig } from "@/lib/supasifieds/monetization-config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const config = await getSupasifiedsMonetizationConfig(supabase);
    return NextResponse.json({ success: true, data: config });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
