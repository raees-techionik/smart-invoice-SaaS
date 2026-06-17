"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/app/_backend/lib/auth/forms";
import { formValue } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

export async function completeBusinessProfile(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const name = formValue(formData, "name");
  const ownerName = formValue(formData, "ownerName");
  const currency = formValue(formData, "currency").toUpperCase();
  const category = formValue(formData, "category");
  const invoicePrefix = formValue(formData, "invoicePrefix").toUpperCase();

  if (!name || !ownerName || !currency || !category || !invoicePrefix) {
    return {
      error:
        "Business name, owner name, currency, category, and invoice prefix are required.",
    };
  }

  await prisma.business.update({
    where: {
      id: user.businessId,
    },
    data: {
      name,
      ownerName,
      phone: formValue(formData, "phone") || null,
      email: formValue(formData, "email") || null,
      address: formValue(formData, "address") || null,
      taxNumber: formValue(formData, "taxNumber") || null,
      currency,
      category,
      invoicePrefix,
      defaultTerms: formValue(formData, "defaultTerms") || null,
      defaultNotes: formValue(formData, "defaultNotes") || null,
      isProfileComplete: true,
    },
  });

  redirect("/dashboard");
}
