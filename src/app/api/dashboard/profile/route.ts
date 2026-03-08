import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// GET — fetch full profile
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const supabase = await createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, bio, kyc_status, wallet_address, role, created_at, phone, email, address_line1, address_line2, city, state, postcode, country, last_seen")
      .eq("id", payload.userId)
      .single();

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// PATCH — update profile fields
export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const allowed = ["display_name", "bio", "phone", "email", "address_line1", "address_line2", "city", "state", "postcode", "country"];
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", payload.userId)
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}