export const userRoles = ["owner", "admin", "staff"] as const;

export type UserRole = (typeof userRoles)[number];

export function isUserRole(role: string): role is UserRole {
  return userRoles.includes(role as UserRole);
}

export function canManageSettings(role: string) {
  return role === "owner" || role === "admin";
}

export function canManageTeam(role: string) {
  return role === "owner";
}
