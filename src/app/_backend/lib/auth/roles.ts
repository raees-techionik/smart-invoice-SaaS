import "server-only";

import { redirect } from "next/navigation";

import {
  canExportData,
  canManageTemplates,
  canManageSettings,
  canManageTeam,
  canRestoreData,
  canViewReports,
  isUserRole,
  userRoles,
  type UserRole,
} from "@/app/_backend/lib/auth/role-utils";
import { requireUser } from "@/app/_backend/lib/auth/session";

export {
  canExportData,
  canManageSettings,
  canManageTeam,
  canManageTemplates,
  canRestoreData,
  canViewReports,
  isUserRole,
  userRoles,
};
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

export async function requireTemplateManager() {
  const user = await requireUser();

  if (!canManageTemplates(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requireReportViewer() {
  const user = await requireUser();

  if (!canViewReports(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requireDataExporter() {
  const user = await requireUser();

  if (!canExportData(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requireBackupRestorer() {
  const user = await requireUser();

  if (!canRestoreData(user.role)) {
    redirect("/dashboard/exports");
  }

  return user;
}
