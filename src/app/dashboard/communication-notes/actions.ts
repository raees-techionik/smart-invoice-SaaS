"use server";

import { revalidatePath } from "next/cache";

import { formValue } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

export type CommunicationNoteActionState = {
  error?: string;
  success?: string;
};

const communicationNoteTypes = new Set([
  "note",
  "call",
  "whatsapp",
  "email",
  "follow_up",
]);

function customerPath(customerId: string) {
  return `/dashboard/customers/${customerId}`;
}

function invoicePath(invoiceId: string) {
  return `/dashboard/invoices/${invoiceId}`;
}

function parseNoteType(value: string) {
  return communicationNoteTypes.has(value) ? value : "note";
}

function followUpDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T09:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createCommunicationNote(
  _state: CommunicationNoteActionState,
  formData: FormData,
): Promise<CommunicationNoteActionState> {
  const user = await requireUser();
  const requestedCustomerId = formValue(formData, "customerId");
  const invoiceId = formValue(formData, "invoiceId");
  const body = formValue(formData, "body");
  const type = parseNoteType(formValue(formData, "type"));
  const followUpAt = followUpDate(formValue(formData, "followUpAt"));

  if (!requestedCustomerId && !invoiceId) {
    return { error: "Attach the note to a customer or invoice." };
  }

  if (!body) {
    return { error: "Write a note before saving." };
  }

  let customerId = requestedCustomerId || null;

  if (invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      select: {
        customerId: true,
        id: true,
      },
      where: {
        businessId: user.businessId,
        id: invoiceId,
      },
    });

    if (!invoice) {
      return { error: "Invoice was not found." };
    }

    if (
      requestedCustomerId &&
      invoice.customerId &&
      requestedCustomerId !== invoice.customerId
    ) {
      return { error: "Customer does not match this invoice." };
    }

    customerId = invoice.customerId ?? customerId;
  }

  if (customerId) {
    const customer = await prisma.customer.findFirst({
      select: {
        id: true,
      },
      where: {
        businessId: user.businessId,
        id: customerId,
      },
    });

    if (!customer) {
      return { error: "Customer was not found." };
    }
  }

  await prisma.communicationNote.create({
    data: {
      body,
      businessId: user.businessId,
      createdById: user.id,
      customerId,
      followUpAt,
      invoiceId: invoiceId || null,
      type,
    },
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/invoices");

  if (customerId) {
    revalidatePath(customerPath(customerId));
  }

  if (invoiceId) {
    revalidatePath(invoicePath(invoiceId));
  }

  return { success: "Communication note added." };
}
