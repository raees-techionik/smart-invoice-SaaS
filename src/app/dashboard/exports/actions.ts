"use server";

import { revalidatePath } from "next/cache";

import {
  previewBusinessBackup,
  restoreBusinessBackupMerge,
  type BackupRestorePreview,
  type BackupRestoreResult,
} from "@/app/_backend/lib/backup-restore";
import { requireBackupRestorer } from "@/app/_backend/lib/auth/roles";

export type BackupRestoreActionState = {
  error?: string;
  preview?: BackupRestorePreview;
  result?: BackupRestoreResult;
  success?: string;
};

const maxBackupBytes = 25 * 1024 * 1024;

function backupFile(formData: FormData) {
  const file = formData.get("backupFile");

  return file instanceof File ? file : null;
}

function shortErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Backup restore could not be completed.";

  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

async function backupTextFromForm(formData: FormData) {
  const file = backupFile(formData);

  if (!file || file.size === 0) {
    throw new Error("Choose a Smart Invoice backup JSON file.");
  }

  if (file.size > maxBackupBytes) {
    throw new Error("Backup file must be 25 MB or smaller.");
  }

  const jsonFilename = file.name.toLowerCase().endsWith(".json");

  if (
    !jsonFilename &&
    file.type !== "application/json" &&
    file.type !== "text/plain"
  ) {
    throw new Error("Backup restore expects the full backup JSON file.");
  }

  return file.text();
}

export async function previewBackupRestore(
  _state: BackupRestoreActionState,
  formData: FormData,
): Promise<BackupRestoreActionState> {
  await requireBackupRestorer();

  try {
    const preview = previewBusinessBackup(await backupTextFromForm(formData));

    return {
      preview,
      success: "Backup file is valid. Review the counts before restoring.",
    };
  } catch (error) {
    return {
      error: shortErrorMessage(error),
    };
  }
}

export async function restoreBackupMerge(
  _state: BackupRestoreActionState,
  formData: FormData,
): Promise<BackupRestoreActionState> {
  const user = await requireBackupRestorer();
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  if (confirmation !== "MERGE RESTORE") {
    return {
      error: 'Type "MERGE RESTORE" to confirm this backup restore.',
    };
  }

  try {
    const result = await restoreBusinessBackupMerge(
      user.businessId,
      await backupTextFromForm(formData),
    );

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/templates");
    revalidatePath("/dashboard/exports");

    return {
      result,
      success: "Backup merge restore completed.",
    };
  } catch (error) {
    return {
      error: shortErrorMessage(error),
    };
  }
}
