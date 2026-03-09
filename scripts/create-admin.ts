// scripts/create-admin.ts
// Run this ONCE to create your first admin account
// Usage: npx ts-node scripts/create-admin.ts

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createAdmin() {
  // ── CHANGE THESE ──────────────────────────────
  const EMAIL    = "admin@supapi.app";
  const PASSWORD = "Change_This_Password_123!";
  const USERNAME = "supapi_admin";
  // ─────────────────────────────────────────────

  console.log("Creating admin account...");

  // 1. Create user row
  const referralCode = randomBytes(4).toString("hex").toUpperCase();

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      pi_uid:       `admin_${randomBytes(8).toString("hex")}`,
      username:     USERNAME,
      display_name: "Supapi Admin",
      email:        EMAIL,
      role:         "admin",
      kyc_status:   "verified",
      referral_code: referralCode,
    })
    .select()
    .single();

  if (userError) {
    console.error("❌ Failed to create user:", userError.message);
    process.exit(1);
  }

  // 2. Hash password
  const hash = await bcrypt.hash(PASSWORD, 12);

  // 3. Save credentials
  const { error: credError } = await supabase
    .from("admin_credentials")
    .insert({ user_id: user.id, password_hash: hash });

  if (credError) {
    console.error("❌ Failed to save credentials:", credError.message);
    process.exit(1);
  }

  console.log("✅ Admin account created!");
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   Login at: /admin/login`);
  console.log("");
  console.log("⚠️  Change your password after first login!");
}

createAdmin().catch(console.error);
