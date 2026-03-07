// app/api/auth/me/route.ts
// GET — Return current user from session cookie

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { createAdminClient } from "@/lib/supabase/server";
import * as R from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    // Read token from cookie
    const cookieStore = await cookies();
    const token = cookieStore.get("supapi_token")?.value;

    if (!token) {
      return R.unauthorized("No session");
    }

    // Verify JWT
    const payload = verifyToken(token);
    if (!payload) {
      return R.unauthorized("Invalid session");
    }

    // Fetch user using admin client (bypasses RLS)
    const supabase = await createAdminClient();
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", payload.userId)
      .single();

    if (error || !user) {
      console.error("[Me] User not found:", payload.userId, error);
      return R.unauthorized("User not found");
    }

    return R.ok({ user });
  } catch (err) {
    console.error("[Me] Error:", err);
    return R.serverError();
  }
}