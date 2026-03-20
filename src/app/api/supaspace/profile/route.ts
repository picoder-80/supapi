import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const {
      display_name,
      bio,
      wallet_address,
      address_line1,
      city,
      postcode,
      country,
    } = await req.json();
    const wallet =
      typeof wallet_address === "string" && wallet_address.trim()
        ? wallet_address.trim()
        : null;
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("users")
      .update({
        display_name,
        bio,
        wallet_address: wallet,
        address_line1: typeof address_line1 === "string" ? address_line1.trim() : null,
        city: typeof city === "string" ? city.trim() : null,
        postcode: typeof postcode === "string" ? postcode.trim() : null,
        country: typeof country === "string" ? country.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.userId)
      .select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: { user: data } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}