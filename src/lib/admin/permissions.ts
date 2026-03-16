import type { AdminRole } from "@/lib/admin/roles";

export type AdminPermission =
  | "admin.settings.read"
  | "admin.settings.password"
  | "admin.settings.create_admin"
  | "admin.treasury.read"
  | "admin.treasury.write"
  | "admin.sc_wallet.read"
  | "admin.email_list.read"
  | "admin.email_list.send"
  | "admin.users.read"
  | "admin.users.ban"
  | "admin.users.role_manage"
  | "admin.market.read"
  | "admin.market.write"
  | "admin.referral.read"
  | "admin.referral.write"
  | "admin.locator.read"
  | "admin.locator.write"
  | "admin.payments.trace"
  | "admin.export.data"
  | "admin.supascrow.read"
  | "admin.supascrow.write";

export const PERMISSIONS_BY_ROLE: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    "admin.settings.read",
    "admin.settings.password",
    "admin.settings.create_admin",
    "admin.treasury.read",
    "admin.treasury.write",
    "admin.sc_wallet.read",
    "admin.email_list.read",
    "admin.email_list.send",
    "admin.users.read",
    "admin.users.ban",
    "admin.users.role_manage",
    "admin.market.read",
    "admin.market.write",
    "admin.referral.read",
    "admin.referral.write",
    "admin.locator.read",
    "admin.locator.write",
    "admin.payments.trace",
    "admin.export.data",
    "admin.supascrow.read",
    "admin.supascrow.write",
  ],
  admin: [
    "admin.settings.read",
    "admin.settings.password",
    "admin.treasury.read",
    "admin.treasury.write",
    "admin.sc_wallet.read",
    "admin.email_list.read",
    "admin.email_list.send",
    "admin.users.read",
    "admin.users.ban",
    "admin.users.role_manage",
    "admin.market.read",
    "admin.market.write",
    "admin.referral.read",
    "admin.referral.write",
    "admin.locator.read",
    "admin.locator.write",
    "admin.payments.trace",
    "admin.export.data",
    "admin.supascrow.read",
    "admin.supascrow.write",
  ],
  account_admin: [
    "admin.settings.read",
    "admin.settings.password",
    "admin.treasury.read",
    "admin.treasury.write",
    "admin.sc_wallet.read",
    "admin.email_list.read",
    "admin.market.read",
    "admin.referral.read",
    "admin.payments.trace",
    "admin.supascrow.read",
    "admin.export.data",
  ],
  staff_admin: [
    "admin.settings.read",
    "admin.settings.password",
    "admin.email_list.read",
    "admin.users.read",
    "admin.users.ban",
    "admin.market.read",
    "admin.market.write",
    "admin.locator.read",
    "admin.locator.write",
    "admin.supascrow.read",
    "admin.supascrow.write",
  ],
  marketing_admin: [
    "admin.settings.read",
    "admin.settings.password",
    "admin.market.read",
    "admin.referral.read",
    "admin.referral.write",
    "admin.sc_wallet.read",
    "admin.email_list.read",
    "admin.email_list.send",
    "admin.export.data",
  ],
};

export function hasAdminPermission(role: string | null | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  const list = PERMISSIONS_BY_ROLE[role as AdminRole] ?? [];
  return list.includes(permission);
}

export function getPermissionLabel(permission: AdminPermission): string {
  const map: Record<AdminPermission, string> = {
    "admin.settings.read": "Read settings",
    "admin.settings.password": "Change own password",
    "admin.settings.create_admin": "Create admin accounts",
    "admin.treasury.read": "View treasury",
    "admin.treasury.write": "Process treasury actions",
    "admin.sc_wallet.read": "View SC wallet analytics",
    "admin.email_list.read": "View email broadcast",
    "admin.email_list.send": "Send email blast campaign",
    "admin.users.read": "View users",
    "admin.users.ban": "Ban or unban users",
    "admin.users.role_manage": "Change user roles",
    "admin.market.read": "View market operations",
    "admin.market.write": "Manage market operations",
    "admin.referral.read": "View referral admin",
    "admin.referral.write": "Manage referral admin",
    "admin.locator.read": "View locator admin",
    "admin.locator.write": "Manage locator moderation",
    "admin.payments.trace": "Trace Pi payments",
    "admin.export.data": "Export admin data",
    "admin.supascrow.read": "View SupaScrow deals and disputes",
    "admin.supascrow.write": "Resolve SupaScrow disputes (release/refund)",
  };
  return map[permission];
}
