// app/api/admin/auth/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { signToken } from "@/lib/auth/jwt";
import bcrypt from "bcryptjs";
import { ADMIN_ROLES } from "@/lib/admin/roles";

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const supabase = await createAdminClient();

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .in("role", [...ADMIN_ROLES])
      .single();

    if (error || !user) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    const { data: adminAuth } = await supabase
      .from("admin_credentials")
      .select("password_hash")
      .eq("user_id", user.id)
      .single();

    if (!adminAuth) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, adminAuth.password_hash);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    await supabase
      .from("admin_credentials")
      .update({ last_login: new Date().toISOString() })
      .eq("user_id", user.id);

    const token = signToken({
      userId:   user.id,
      piUid:    user.pi_uid ?? "",
      username: user.username,
      role:     user.role ?? "admin",
    });

    // Return token in body — client stores in localStorage
    return NextResponse.json({
      success: true,
      data:    { username: user.username, token },
      message: "Signed in successfully",
    });

  } catch (err) {
    console.error("[Admin Auth]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  return NextResponse.json({ success: true });
}