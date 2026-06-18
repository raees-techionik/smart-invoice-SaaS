"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { formValue, normalizeEmail } from "@/app/_backend/lib/auth/forms";
import { hashPassword } from "@/app/_backend/lib/auth/password";
import {
  isUserRole,
  requireSettingsManager,
  requireTeamManager,
  type UserRole,
} from "@/app/_backend/lib/auth/roles";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { decryptSecret, encryptSecret } from "@/app/_backend/lib/email-settings";
import { validateEmailDeliverySettings } from "@/app/_backend/lib/invoice-delivery";
import { sendSmtpMail } from "@/app/_backend/lib/smtp-client";

export type SettingsActionState = {
  error?: string;
  success?: string;
};

const uploadConfig = {
  logo: {
    dir: "logos",
    field: "logoPath",
  },
  signature: {
    dir: "signatures",
    field: "signaturePath",
  },
  stamp: {
    dir: "stamps",
    field: "stampPath",
  },
} as const;

const allowedImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/svg+xml", ".svg"],
  ["image/webp", ".webp"],
]);

const maxUploadBytes = 2 * 1024 * 1024;

function nullableValue(formData: FormData, key: string) {
  return formValue(formData, key) || null;
}

function cleanCurrency(value: string) {
  return value.trim().toUpperCase();
}

function cleanInvoicePrefix(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

function parseRole(value: string): UserRole | null {
  return isUserRole(value) ? value : null;
}

function parseStatus(value: string) {
  return value === "inactive" ? "inactive" : "active";
}

function checkedValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseSmtpPort(value: string) {
  const port = Number(value);

  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

function shortErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Email test failed.";

  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

async function saveUploadFile(file: File, target: keyof typeof uploadConfig) {
  if (!file || file.size === 0) {
    return null;
  }

  const extension = allowedImageTypes.get(file.type);

  if (!extension) {
    return {
      error: "Upload must be a JPG, PNG, SVG, or WebP image.",
    };
  }

  if (file.size > maxUploadBytes) {
    return {
      error: "Upload must be 2 MB or smaller.",
    };
  }

  const config = uploadConfig[target];
  const uploadRoot = path.join(process.cwd(), "uploads", config.dir);
  const filename = `${target}-${randomUUID()}${extension}`;
  const absolutePath = path.join(uploadRoot, filename);
  const relativePath = path.posix.join("uploads", config.dir, filename);

  await mkdir(uploadRoot, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    path: relativePath,
  };
}

export async function updateBusinessSettings(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireSettingsManager();
  const name = formValue(formData, "name");
  const ownerName = formValue(formData, "ownerName");
  const currency = cleanCurrency(formValue(formData, "currency"));
  const category = formValue(formData, "category");
  const invoicePrefix = cleanInvoicePrefix(formValue(formData, "invoicePrefix"));

  if (!name || !ownerName || !currency || !category || !invoicePrefix) {
    return {
      error:
        "Business name, owner name, currency, category, and invoice prefix are required.",
    };
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: "Currency must be a 3-letter code like PKR or USD." };
  }

  await prisma.business.update({
    data: {
      address: nullableValue(formData, "address"),
      category,
      currency,
      defaultNotes: nullableValue(formData, "defaultNotes"),
      defaultTerms: nullableValue(formData, "defaultTerms"),
      email: nullableValue(formData, "email"),
      invoicePrefix,
      isProfileComplete: true,
      name,
      ownerName,
      phone: nullableValue(formData, "phone"),
      taxNumber: nullableValue(formData, "taxNumber"),
    },
    where: {
      id: user.businessId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");

  return { success: "Business settings updated." };
}

export async function uploadBusinessAsset(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireSettingsManager();
  const assetType = formValue(formData, "assetType");

  if (!(assetType in uploadConfig)) {
    return { error: "Select a valid asset type." };
  }

  const file = formData.get("asset");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file to upload." };
  }

  const savedFile = await saveUploadFile(
    file,
    assetType as keyof typeof uploadConfig,
  );

  if (!savedFile || "error" in savedFile) {
    return { error: savedFile?.error ?? "Could not save uploaded file." };
  }

  const field = uploadConfig[assetType as keyof typeof uploadConfig].field;

  await prisma.business.update({
    data: {
      [field]: savedFile.path,
    },
    where: {
      id: user.businessId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");

  return { success: `${assetType} uploaded.` };
}

export async function updateBusinessEmailSettings(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireSettingsManager();
  const fromName = formValue(formData, "fromName");
  const fromEmail = normalizeEmail(formValue(formData, "fromEmail"));
  const replyToEmail = normalizeEmail(formValue(formData, "replyToEmail"));
  const smtpHost = formValue(formData, "smtpHost");
  const smtpPort = parseSmtpPort(formValue(formData, "smtpPort"));
  const smtpUsername = formValue(formData, "smtpUsername") || null;
  const smtpPassword = formValue(formData, "smtpPassword");
  const smtpSecure = checkedValue(formData, "smtpSecure");

  if (!fromName || !fromEmail || !smtpHost || !smtpPort) {
    return {
      error: "From name, from email, SMTP host, and SMTP port are required.",
    };
  }

  if (!validEmail(fromEmail)) {
    return { error: "Enter a valid from email." };
  }

  if (replyToEmail && !validEmail(replyToEmail)) {
    return { error: "Enter a valid reply-to email." };
  }

  const existingSettings = await prisma.businessEmailSetting.findUnique({
    where: {
      businessId: user.businessId,
    },
  });

  if (smtpUsername && !smtpPassword && !existingSettings?.smtpPasswordEncrypted) {
    return {
      error:
        "Enter the SMTP password once, or clear the username for an unauthenticated SMTP server.",
    };
  }

  const smtpPasswordEncrypted = smtpPassword
    ? encryptSecret(smtpPassword)
    : existingSettings?.smtpPasswordEncrypted ?? null;

  await prisma.businessEmailSetting.upsert({
    create: {
      businessId: user.businessId,
      fromEmail,
      fromName,
      replyToEmail: replyToEmail || null,
      smtpHost,
      smtpPasswordEncrypted,
      smtpPort,
      smtpSecure,
      smtpUsername,
    },
    update: {
      fromEmail,
      fromName,
      replyToEmail: replyToEmail || null,
      smtpHost,
      smtpPasswordEncrypted,
      smtpPort,
      smtpSecure,
      smtpUsername,
    },
    where: {
      businessId: user.businessId,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/invoices");

  return { success: "Email delivery settings saved." };
}

export async function sendBusinessEmailTest(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireSettingsManager();
  const recipientEmail = normalizeEmail(formValue(formData, "recipientEmail"));

  if (!recipientEmail || !validEmail(recipientEmail)) {
    return { error: "Enter a valid recipient email for the test." };
  }

  const settings = await prisma.businessEmailSetting.findUnique({
    where: {
      businessId: user.businessId,
    },
  });
  const settingsError = validateEmailDeliverySettings(settings);

  if (settingsError) {
    return { error: settingsError };
  }

  if (!settings) {
    return { error: "Configure SMTP settings before sending a test email." };
  }

  try {
    const result = await sendSmtpMail(
      {
        host: settings.smtpHost,
        password: settings.smtpPasswordEncrypted
          ? decryptSecret(settings.smtpPasswordEncrypted)
          : null,
        port: settings.smtpPort,
        secure: settings.smtpSecure,
        username: settings.smtpUsername,
      },
      {
        body: `This is a test email from ${user.business.name}.\n\nIf you received this, your SMTP settings are working.`,
        from: {
          email: settings.fromEmail,
          name: settings.fromName,
        },
        replyTo: settings.replyToEmail,
        subject: `Test email from ${user.business.name}`,
        to: [recipientEmail],
      },
    );

    return {
      success: `Test email sent to ${recipientEmail}. Message ID: ${result.messageId}`,
    };
  } catch (error) {
    return { error: `Email test failed: ${shortErrorMessage(error)}` };
  }
}

export async function createTeamUser(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireTeamManager();
  const name = formValue(formData, "name");
  const email = normalizeEmail(formValue(formData, "email"));
  const password = formValue(formData, "password");
  const role = parseRole(formValue(formData, "role"));

  if (!name || !email || !password || !role) {
    return { error: "Name, email, password, and role are required." };
  }

  if (role === "owner") {
    return { error: "There can only be one owner account." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  try {
    await prisma.user.create({
      data: {
        businessId: user.businessId,
        email,
        name,
        password: hashPassword(password),
        role,
        status: "active",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "A user with this email already exists." };
    }

    throw error;
  }

  revalidatePath("/dashboard/settings");

  return { success: "Team user created." };
}

export async function updateTeamUser(formData: FormData) {
  const user = await requireTeamManager();
  const targetUserId = formValue(formData, "userId");
  const role = parseRole(formValue(formData, "role"));
  const status = parseStatus(formValue(formData, "status"));

  if (!targetUserId || !role) {
    return;
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      businessId: user.businessId,
      id: targetUserId,
    },
  });

  if (!targetUser || targetUser.role === "owner") {
    return;
  }

  await prisma.user.update({
    data: {
      role: role === "owner" ? targetUser.role : role,
      status,
    },
    where: {
      id: targetUser.id,
    },
  });

  if (status !== "active") {
    await prisma.session.deleteMany({
      where: {
        userId: targetUser.id,
      },
    });
  }

  revalidatePath("/dashboard/settings");
}

export async function resetTeamUserPassword(formData: FormData) {
  const user = await requireTeamManager();
  const targetUserId = formValue(formData, "userId");
  const password = formValue(formData, "password");

  if (!targetUserId || !password) {
    return;
  }

  if (password.length < 8) {
    return;
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      businessId: user.businessId,
      id: targetUserId,
    },
  });

  if (!targetUser || targetUser.role === "owner") {
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      data: {
        password: hashPassword(password),
        status: "active",
      },
      where: {
        id: targetUser.id,
      },
    }),
    prisma.session.deleteMany({
      where: {
        userId: targetUser.id,
      },
    }),
  ]);

  revalidatePath("/dashboard/settings");
}
