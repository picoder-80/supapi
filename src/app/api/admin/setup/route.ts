// app/api/admin/setup/route.ts
// TEMPORARY — run once to create admin account, then delete this file

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId, password, secretKey } = await req.json();

  // Basic protection
  if (secretKey !== "supapi-setup-2026") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAdminClient();
  const hash = await bcrypt.hash(password, 10);

  // Set role to admin
  await supabase
    .from("users")
    .update({ role: "admin", email: "wandy80@supapi.admin" })
    .eq("id", userId);

  // Upsert admin credentials with bcrypt hash
  const { error } = await supabase
    .from("admin_credentials")
    .upsert({
      user_id:       userId,
      password_hash: hash,
    }, { onConflict: "user_id" });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true, message: "Admin created!" });
}