"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { formValue } from "@/app/_backend/lib/auth/forms";
import { requireTemplateManager } from "@/app/_backend/lib/auth/roles";
import { prisma } from "@/app/_backend/lib/db/prisma";
import {
  invoiceTemplateDensityOptions,
  invoiceTemplateHeaderStyles,
  invoiceTemplateLogoPlacements,
  invoiceTemplateSignaturePlacements,
  invoiceTemplateStampPlacements,
  isInvoiceTemplateLayout,
  safeTemplateAccentColor,
  stringifyInvoiceTemplateSettings,
  type InvoiceTemplateSettings,
} from "@/app/_backend/lib/invoice-templates";

export type InvoiceTemplateActionState = {
  error?: string;
  success?: string;
};

function booleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function nullableText(value: string) {
  return value.trim();
}

function optionValue<T extends readonly string[]>(
  values: T,
  value: string,
  fallback: T[number],
): T[number] {
  return values.includes(value) ? value : fallback;
}

function templatePath(templateId: string) {
  return `/dashboard/templates/${templateId}`;
}

function templateSettingsFromForm(
  formData: FormData,
): InvoiceTemplateSettings | { error: string } {
  const layout = formValue(formData, "layout");

  if (!isInvoiceTemplateLayout(layout)) {
    return { error: "Select a valid invoice layout." };
  }

  return {
    accentColor: safeTemplateAccentColor(formValue(formData, "accentColor")),
    defaultNotes: nullableText(formValue(formData, "defaultNotes")),
    defaultTerms: nullableText(formValue(formData, "defaultTerms")),
    density: optionValue(
      invoiceTemplateDensityOptions,
      formValue(formData, "density"),
      "comfortable",
    ),
    footerText: nullableText(formValue(formData, "footerText")),
    headerStyle: optionValue(
      invoiceTemplateHeaderStyles,
      formValue(formData, "headerStyle"),
      "split",
    ),
    layout,
    logoPlacement: optionValue(
      invoiceTemplateLogoPlacements,
      formValue(formData, "logoPlacement"),
      booleanValue(formData, "showLogo") ? "left" : "hidden",
    ),
    paymentInstructions: nullableText(
      formValue(formData, "paymentInstructions"),
    ),
    showBalanceBox: booleanValue(formData, "showBalanceBox"),
    showBusinessTaxNumber: booleanValue(formData, "showBusinessTaxNumber"),
    showCustomerContacts: booleanValue(formData, "showCustomerContacts"),
    showItemDescriptions: booleanValue(formData, "showItemDescriptions"),
    showLogo: booleanValue(formData, "showLogo"),
    showSignature: booleanValue(formData, "showSignature"),
    showStamp: booleanValue(formData, "showStamp"),
    signatureLabel:
      nullableText(formValue(formData, "signatureLabel")) ||
      "Authorized signature",
    signaturePlacement: optionValue(
      invoiceTemplateSignaturePlacements,
      formValue(formData, "signaturePlacement"),
      booleanValue(formData, "showSignature") ? "left" : "hidden",
    ),
    stampPlacement: optionValue(
      invoiceTemplateStampPlacements,
      formValue(formData, "stampPlacement"),
      booleanValue(formData, "showStamp") ? "near_signature" : "hidden",
    ),
  };
}

export async function createInvoiceTemplate(
  _state: InvoiceTemplateActionState,
  formData: FormData,
): Promise<InvoiceTemplateActionState> {
  const user = await requireTemplateManager();
  const name = formValue(formData, "name");
  const settings = templateSettingsFromForm(formData);
  const shouldSetDefault = booleanValue(formData, "isDefault");

  if (!name) {
    return { error: "Template name is required." };
  }

  if ("error" in settings) {
    return { error: settings.error };
  }

  const existingCount = await prisma.invoiceTemplate.count({
    where: {
      businessId: user.businessId,
    },
  });

  await prisma.$transaction(async (tx) => {
    if (shouldSetDefault || existingCount === 0) {
      await tx.invoiceTemplate.updateMany({
        data: {
          isDefault: false,
        },
        where: {
          businessId: user.businessId,
        },
      });
    }

    await tx.invoiceTemplate.create({
      data: {
        businessId: user.businessId,
        isDefault: shouldSetDefault || existingCount === 0,
        name,
        settings: stringifyInvoiceTemplateSettings(settings),
      },
    });
  });

  revalidatePath("/dashboard/templates");
  revalidatePath("/dashboard/invoices");

  return { success: "Invoice template created." };
}

export async function updateInvoiceTemplate(
  _state: InvoiceTemplateActionState,
  formData: FormData,
): Promise<InvoiceTemplateActionState> {
  const user = await requireTemplateManager();
  const templateId = formValue(formData, "templateId");
  const name = formValue(formData, "name");
  const settings = templateSettingsFromForm(formData);
  const shouldSetDefault = booleanValue(formData, "isDefault");

  if (!templateId) {
    return { error: "Template id is required." };
  }

  if (!name) {
    return { error: "Template name is required." };
  }

  if ("error" in settings) {
    return { error: settings.error };
  }

  const template = await prisma.invoiceTemplate.findFirst({
    where: {
      businessId: user.businessId,
      id: templateId,
    },
  });

  if (!template) {
    return { error: "Invoice template was not found." };
  }

  await prisma.$transaction(async (tx) => {
    if (shouldSetDefault) {
      await tx.invoiceTemplate.updateMany({
        data: {
          isDefault: false,
        },
        where: {
          businessId: user.businessId,
        },
      });
    }

    await tx.invoiceTemplate.update({
      data: {
        isDefault: shouldSetDefault,
        name,
        settings: stringifyInvoiceTemplateSettings(settings),
      },
      where: {
        id: template.id,
      },
    });
  });

  revalidatePath("/dashboard/templates");
  revalidatePath(templatePath(template.id));
  revalidatePath("/dashboard/invoices");

  return { success: "Invoice template updated." };
}

export async function setDefaultInvoiceTemplate(formData: FormData) {
  const user = await requireTemplateManager();
  const templateId = formValue(formData, "templateId");

  if (!templateId) {
    return;
  }

  const template = await prisma.invoiceTemplate.findFirst({
    where: {
      businessId: user.businessId,
      id: templateId,
    },
  });

  if (!template) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceTemplate.updateMany({
      data: {
        isDefault: false,
      },
      where: {
        businessId: user.businessId,
      },
    });

    await tx.invoiceTemplate.update({
      data: {
        isDefault: true,
      },
      where: {
        id: template.id,
      },
    });
  });

  revalidatePath("/dashboard/templates");
  revalidatePath(templatePath(template.id));
  revalidatePath("/dashboard/invoices");
}

export async function duplicateInvoiceTemplate(formData: FormData) {
  const user = await requireTemplateManager();
  const templateId = formValue(formData, "templateId");

  if (!templateId) {
    return;
  }

  const template = await prisma.invoiceTemplate.findFirst({
    where: {
      businessId: user.businessId,
      id: templateId,
    },
  });

  if (!template) {
    return;
  }

  const duplicate = await prisma.invoiceTemplate.create({
    data: {
      businessId: user.businessId,
      isDefault: false,
      name: `Copy of ${template.name}`,
      settings: template.settings,
    },
  });

  revalidatePath("/dashboard/templates");
  revalidatePath("/dashboard/invoices");

  redirect(templatePath(duplicate.id));
}

export async function deleteInvoiceTemplate(formData: FormData) {
  const user = await requireTemplateManager();
  const templateId = formValue(formData, "templateId");

  if (!templateId) {
    return;
  }

  const template = await prisma.invoiceTemplate.findFirst({
    include: {
      _count: {
        select: {
          invoices: true,
        },
      },
    },
    where: {
      businessId: user.businessId,
      id: templateId,
    },
  });

  if (!template) {
    return;
  }

  if (template._count.invoices > 0) {
    revalidatePath("/dashboard/templates");
    revalidatePath(templatePath(template.id));
    return;
  }

  await prisma.invoiceTemplate.delete({
    where: {
      id: template.id,
    },
  });

  const defaultTemplate = await prisma.invoiceTemplate.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    where: {
      businessId: user.businessId,
    },
  });

  if (template.isDefault && defaultTemplate) {
    await prisma.invoiceTemplate.update({
      data: {
        isDefault: true,
      },
      where: {
        id: defaultTemplate.id,
      },
    });
  }

  revalidatePath("/dashboard/templates");
  revalidatePath("/dashboard/invoices");

  redirect("/dashboard/templates");
}
