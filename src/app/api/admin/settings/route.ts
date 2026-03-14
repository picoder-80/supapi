import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { ADMIN_ROLES, getAdminRoleLabel } from "@/lib/admin/roles";
import { getPermissionLabel, hasAdminPermission, PERMISSIONS_BY_ROLE } from "@/lib/admin/permissions";
import { generateReferralCode } from "@/lib/referral";
import { logAdminAction } from "@/lib/security/audit";

const passwordSchema = z.object({
  current_password: z.string().min(8),
  new_password: z.string().min(8),
});

const createAdminSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1).max(80).optional(),
  admin_role: z.enum(ADMIN_ROLES),
});

async function getAdminsSnapshot() {
  const supabase = await createAdminClient();
  const { data: admins, error } = await supabase
    .from("users")
    .select("id, username, display_name, email, role, created_at")
    .in("role", [...ADMIN_ROLES])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const adminIds = (admins ?? []).map((a: any) => String(a.id));
  let credMap: Record<string, { last_login?: string | null }> = {};
  if (adminIds.length) {
    const { data: creds, error: credErr } = await supabase
      .from("admin_credentials")
      .select("user_id, last_login")
      .in("user_id", adminIds);
    if (credErr) throw new Error(credErr.message);
    credMap = Object.fromEntries((creds ?? []).map((c: any) => [String(c.user_id), { last_login: c.last_login ?? null }]));
  }

  return (admins ?? []).map((a: any) => ({
    ...a,
    role_label: getAdminRoleLabel(String(a.role ?? "admin")),
    last_login: credMap[String(a.id)]?.last_login ?? null,
  }));
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAdminPermission(auth.role, "admin.settings.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = await createAdminClient();
    const [{ data: me, error: meErr }, admins] = await Promise.all([
      supabase
        .from("users")
        .select("id, username, display_name, email, role, created_at")
        .eq("id", auth.userId)
        .single(),
      getAdminsSnapshot(),
    ]);
    if (meErr || !me) return NextResponse.json({ success: false, error: "Admin user not found" }, { status: 404 });

    return NextResponse.json({
      success: true,
      data: {
        me: { ...me, role_label: getAdminRoleLabel(String(me.role ?? "admin")) },
        capabilities: {
          can_create_admin: hasAdminPermission(auth.role, "admin.settings.create_admin"),
        },
        admins,
        role_options: ADMIN_ROLES.map((role) => ({ value: role, label: getAdminRoleLabel(role) })),
        role_permissions: ADMIN_ROLES.map((role) => ({
          role,
          role_label: getAdminRoleLabel(role),
          permissions: (PERMISSIONS_BY_ROLE[role] ?? []).map((p) => ({ key: p, label: getPermissionLabel(p) })),
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAdminPermission(auth.role, "admin.settings.password")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid password payload" }, { status: 400 });
    }
    const { current_password, new_password } = parsed.data;
    if (current_password === new_password) {
      return NextResponse.json({ success: false, error: "New password must be different" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const { data: cred, error: credErr } = await supabase
      .from("admin_credentials")
      .select("password_hash")
      .eq("user_id", auth.userId)
      .single();
    if (credErr || !cred) return NextResponse.json({ success: false, error: "Admin credential not found" }, { status: 404 });

    const ok = await bcrypt.compare(current_password, cred.password_hash);
    if (!ok) return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 400 });

    const nextHash = await bcrypt.hash(new_password, 10);
    const { error: updErr } = await supabase
      .from("admin_credentials")
      .update({ password_hash: nextHash })
      .eq("user_id", auth.userId);
    if (updErr) return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });

    if (auth.userId) {
      await logAdminAction({
        adminUserId: auth.userId,
        action: "admin_password_change",
        targetType: "admin",
        targetId: auth.userId,
        detail: { via: "settings" },
      });
    }

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAdminPermission(auth.role, "admin.settings.create_admin")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createAdminSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid create admin payload" }, { status: 400 });
    }

    const { username, email, password, admin_role, display_name } = parsed.data;
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = await createAdminClient();

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .or(`username.eq.${normalizedUsername},email.eq.${normalizedEmail}`)
      .limit(1);
    if ((existing ?? []).length > 0) {
      return NextResponse.json({ success: false, error: "Username or email already in use" }, { status: 409 });
    }

    const referralCode = generateReferralCode(normalizedUsername);
    const pseudoPiUid = `admin_${crypto.randomUUID()}`;

    const { data: createdUser, error: userErr } = await supabase
      .from("users")
      .insert({
        pi_uid: pseudoPiUid,
        username: normalizedUsername,
        display_name: display_name?.trim() || normalizedUsername,
        email: normalizedEmail,
        role: admin_role,
        kyc_status: "verified",
        referral_code: referralCode,
      })
      .select("id, username, display_name, email, role, created_at")
      .single();

    if (userErr || !createdUser) {
      return NextResponse.json({ success: false, error: userErr?.message ?? "Failed to create admin user" }, { status: 500 });
    }

    const hash = await bcrypt.hash(password, 10);
    const { error: credErr } = await supabase.from("admin_credentials").insert({
      user_id: createdUser.id,
      password_hash: hash,
      last_login: null,
    });
    if (credErr) {
      await supabase.from("users").delete().eq("id", createdUser.id);
      return NextResponse.json({ success: false, error: credErr.message }, { status: 500 });
    }

    if (auth.userId) {
      await logAdminAction({
        adminUserId: auth.userId,
        action: "admin_account_create",
        targetType: "user",
        targetId: createdUser.id,
        detail: { role: admin_role, username: normalizedUsername },
      });
    }

    return NextResponse.json({
      success: true,
      data: { ...createdUser, role_label: getAdminRoleLabel(String(createdUser.role ?? "admin")) },
      message: "Admin account created",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Server error" }, { status: 500 });
  }
}
