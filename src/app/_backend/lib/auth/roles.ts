import "server-only";

import { redirect } from "next/navigation";

import {
  canManageSettings,
  canManageTeam,
  isUserRole,
  userRoles,
  type UserRole,
} from "@/app/_backend/lib/auth/role-utils";
import { requireUser } from "@/app/_backend/lib/auth/session";

export { canManageSettings, canManageTeam, isUserRole, userRoles };
export type { UserRole };

export async function requireSettingsManager() {
  const user = await requireUser();

  if (!canManageSettings(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requireTeamManager() {
  const user = await requireUser();

  if (!canManageTeam(user.role)) {
    redirect("/dashboard/settings");
  }

  return user;
}
