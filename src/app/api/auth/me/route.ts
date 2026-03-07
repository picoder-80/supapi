// app/api/auth/me/route.ts
// GET — Return current user from session cookie

import { getCurrentUser } from "@/lib/auth/session";
import * as R from "@/lib/api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return R.unauthorized("Not signed in");
    return R.ok({ user });
  } catch (err) {
    console.error("[Me] Error:", err);
    return R.serverError();
  }
}