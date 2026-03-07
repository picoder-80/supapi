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

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return R.badRequest("Invalid email or password format");

    const { email, password } = parsed.data;
    const supabase = await createAdminClient();

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .eq("role", "admin")
      .single();

    if (error || !user) return R.unauthorized("Invalid credentials");

    const { data: adminAuth } = await supabase
      .from("admin_credentials")
      .select("password_hash")
      .eq("user_id", user.id)
      .single();

    if (!adminAuth) return R.unauthorized("Invalid credentials");

    const valid = await bcrypt.compare(password, adminAuth.password_hash);
    if (!valid) return R.unauthorized("Invalid credentials");

    await supabase
      .from("admin_credentials")
      .update({ last_login: new Date().toISOString() })
      .eq("user_id", user.id);

    const token = signToken({
      userId:   user.id,
      piUid:    user.pi_uid ?? "",
      username: user.username,
      role:     "admin",
    });

    // Try all cookie methods simultaneously
    const res = NextResponse.json({
      success: true,
      data: { username: user.username, token },
      message: "Signed in successfully"
    });

    // Method 1: NextResponse cookies
    res.cookies.set({
      name:     "supapi_admin_token",
      value:    token,
      httpOnly: true,
      secure:   true,
      sameSite: "lax",
      maxAge:   60 * 60 * 8,
      path:     "/",
    });

    // Method 2: Set-Cookie header directly
    res.headers.append(
      "Set-Cookie",
      `supapi_admin_token=${token}; Path=/; Max-Age=${60 * 60 * 8}; HttpOnly; Secure; SameSite=Lax`
    );

    return res;
  } catch (err) {
    console.error("[Admin Auth]", err);
    return R.serverError();
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete("supapi_admin_token");
  return res;
}