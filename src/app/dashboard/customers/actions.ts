"use server";

import { revalidatePath } from "next/cache";

import { formValue, normalizeEmail } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

export type CustomerActionState = {
  error?: string;
  success?: string;
  warning?: string;
};

function nullableValue(formData: FormData, key: string) {
  return formValue(formData, key) || null;
}

function openingBalanceValue(formData: FormData) {
  const rawValue = formValue(formData, "openingBalance").replace(/,/g, "");

  if (!rawValue) {
    return { value: "0" };
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(rawValue)) {
    return {
      error: "Opening balance must be a valid amount with up to 2 decimals.",
    };
  }

  return { value: rawValue };
}

function customerPath(customerId: string) {
  return `/dashboard/customers/${customerId}`;
}

async function duplicateCustomerWarning({
  businessId,
  customerId,
  email,
  name,
  phone,
}: {
  businessId: string;
  customerId?: string;
  email: string | null;
  name: string;
  phone: string | null;
}) {
  const duplicate = await prisma.customer.findFirst({
    select: {
      businessName: true,
      email: true,
      id: true,
      name: true,
      phone: true,
    },
    where: {
      businessId,
      id: customerId
        ? {
            not: customerId,
          }
        : undefined,
      OR: [
        {
          name,
        },
        ...(phone
          ? [
              {
                phone,
              },
            ]
          : []),
        ...(email
          ? [
              {
                email,
              },
            ]
          : []),
      ],
    },
  });

  if (!duplicate) {
    return undefined;
  }

  return `Possible duplicate: ${duplicate.name}${
    duplicate.businessName ? `, ${duplicate.businessName}` : ""
  }${duplicate.phone ? ` (${duplicate.phone})` : ""}.`;
}

export async function createCustomer(
  _state: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const user = await requireUser();
  const name = formValue(formData, "name");
  const email = normalizeEmail(formValue(formData, "email")) || null;
  const phone = nullableValue(formData, "phone");

  if (!name) {
    return { error: "Customer name is required." };
  }

  const openingBalance = openingBalanceValue(formData);

  if (openingBalance.error) {
    return { error: openingBalance.error };
  }

  const customer = await prisma.customer.create({
    data: {
      businessId: user.businessId,
      name,
      businessName: nullableValue(formData, "businessName"),
      phone,
      email,
      address: nullableValue(formData, "address"),
      taxNumber: nullableValue(formData, "taxNumber"),
      openingBalance: openingBalance.value,
      notes: nullableValue(formData, "notes"),
      status: formValue(formData, "status") || "active",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");

  const warning = await duplicateCustomerWarning({
    businessId: user.businessId,
    customerId: customer.id,
    email,
    name,
    phone,
  });

  return { success: "Customer saved.", warning };
}

export async function updateCustomer(
  _state: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const user = await requireUser();
  const customerId = formValue(formData, "customerId");
  const name = formValue(formData, "name");
  const email = normalizeEmail(formValue(formData, "email")) || null;
  const phone = nullableValue(formData, "phone");

  if (!customerId) {
    return { error: "Customer id is required." };
  }

  if (!name) {
    return { error: "Customer name is required." };
  }

  const existingCustomer = await prisma.customer.findFirst({
    where: {
      businessId: user.businessId,
      id: customerId,
    },
  });

  if (!existingCustomer) {
    return { error: "Customer was not found." };
  }

  const openingBalance = openingBalanceValue(formData);

  if (openingBalance.error) {
    return { error: openingBalance.error };
  }

  await prisma.customer.update({
    data: {
      address: nullableValue(formData, "address"),
      businessName: nullableValue(formData, "businessName"),
      email,
      name,
      notes: nullableValue(formData, "notes"),
      openingBalance: openingBalance.value,
      phone,
      status: formValue(formData, "status") || "active",
      taxNumber: nullableValue(formData, "taxNumber"),
    },
    where: {
      id: customerId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");
  revalidatePath(customerPath(customerId));

  const warning = await duplicateCustomerWarning({
    businessId: user.businessId,
    customerId,
    email,
    name,
    phone,
  });

  return { success: "Customer updated.", warning };
}

export async function archiveCustomer(formData: FormData) {
  const user = await requireUser();
  const customerId = formValue(formData, "customerId");

  if (!customerId) {
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: {
      businessId: user.businessId,
      id: customerId,
    },
  });

  if (!customer) {
    return;
  }

  await prisma.customer.update({
    data: {
      status: "inactive",
    },
    where: {
      id: customerId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");
  revalidatePath(customerPath(customerId));
}
