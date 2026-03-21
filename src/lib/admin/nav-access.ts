import { hasAdminPermission, type AdminPermission } from "@/lib/admin/permissions";

const NAV_PERMISSION_RULES: Array<{ prefix: string; permission: AdminPermission }> = [
  { prefix: "/admin/settings", permission: "admin.settings.read" },
  { prefix: "/admin/treasury", permission: "admin.treasury.read" },
  { prefix: "/admin/sc-wallet", permission: "admin.sc_wallet.read" },
  { prefix: "/admin/email-list", permission: "admin.email_list.read" },
  { prefix: "/admin/users", permission: "admin.users.read" },
  { prefix: "/admin/supamarket", permission: "admin.market.read" },
  { prefix: "/admin/platforms/referral", permission: "admin.referral.read" },
  { prefix: "/admin/platforms/locator", permission: "admin.locator.read" },
  { prefix: "/admin/platforms/supascrow", permission: "admin.supascrow.read" },
  { prefix: "/admin/platforms/supaminds", permission: "admin.market.read" },
  // SupaChat: no nav rule — always visible in sidebar; API protects commission data
];

export function canAccessAdminHref(role: string | null | undefined, href: string): boolean {
  const rule = NAV_PERMISSION_RULES.find((r) => href.startsWith(r.prefix));
  if (!rule) return true;
  return hasAdminPermission(role, rule.permission);
}

export function canAccessAdminPath(role: string | null | undefined, pathname: string): boolean {
  const rule = NAV_PERMISSION_RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return true;
  return hasAdminPermission(role, rule.permission);
}
