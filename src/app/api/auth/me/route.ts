// app/api/auth/me/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    // Read token from Authorization header (localStorage flow)
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";

    if (!token) {
      return NextResponse.json({ success: false, error: "No session" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
    }

    const supabase = await createAdminClient();
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", payload.userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
    }

    return NextResponse.json({ success: true, data: { user } });
  } catch (err) {
    console.error("[Me] Error:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}