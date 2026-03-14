export const ADMIN_ROLES = [
  "super_admin",
  "admin",
  "account_admin",
  "staff_admin",
  "marketing_admin",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  if (!role) return false;
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export function getAdminRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Regular Admin",
    account_admin: "Account Admin",
    staff_admin: "Moderation/Staff",
    marketing_admin: "Marketing Admin",
  };
  return labels[role] ?? role.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
