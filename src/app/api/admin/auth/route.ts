// app/api/admin/auth/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { signToken } from "@/lib/auth/jwt";
import bcrypt from "bcryptjs";
import * as R from "@/lib/api";

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
});

// POST — Admin login
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return R.badRequest("Invalid email or password format");

    const { email, password } = parsed.data;
    const supabase = await createAdminClient();

    // Find admin user
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .eq("role", "admin")
      .single();

    if (error || !user) return R.unauthorized("Invalid credentials");

    // Verify password
    const { data: adminAuth } = await supabase
      .from("admin_credentials")
      .select("password_hash")
      .eq("user_id", user.id)
      .single();

    if (!adminAuth) return R.unauthorized("Invalid credentials");

    const valid = await bcrypt.compare(password, adminAuth.password_hash);
    if (!valid) return R.unauthorized("Invalid credentials");

    // Update last login
    await supabase
      .from("admin_credentials")
      .update({ last_login: new Date().toISOString() })
      .eq("user_id", user.id);

    // Issue admin JWT
    const token = signToken({
      userId:   user.id,
      piUid:    user.pi_uid ?? "",
      username: user.username,
      role:     "admin",
    });

    // Set cookie via NextResponse header directly — more reliable in production
    const res = NextResponse.json({ success: true, data: { username: user.username }, message: "Signed in successfully" });
    res.cookies.set("supapi_admin_token", token, {
      httpOnly: true,
      secure:   true,
      sameSite: "none",
      maxAge:   60 * 60 * 8,
      path:     "/",
    });

    return res;
  } catch (err) {
    console.error("[Admin Auth]", err);
    return R.serverError();
  }
}

// DELETE — Admin logout
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete("supapi_admin_token");
  return res;
}