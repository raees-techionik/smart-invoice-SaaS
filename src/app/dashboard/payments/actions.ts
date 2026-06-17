"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { formValue } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

export type PaymentActionState = {
  error?: string;
  success?: string;
};

type ParsedDecimal =
  | {
      ok: true;
      value: Prisma.Decimal;
    }
  | {
      ok: false;
      error: string;
    };

function decimalValue(value: string, label: string): ParsedDecimal {
  const rawValue = value.trim().replace(/,/g, "");

  if (!rawValue) {
    return { ok: false, error: `${label} is required.` };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
    return {
      ok: false,
      error: `${label} must be a positive amount with up to 2 decimals.`,
    };
  }

  return { ok: true, value: new Prisma.Decimal(rawValue) };
}

function dateValue(value: string) {
  if (!value) {
    return new Date();
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function moneyString(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2).toFixed(2);
}

function invoicePath(invoiceId: string) {
  return `/dashboard/invoices/${invoiceId}`;
}

export async function recordPayment(
  _state: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const user = await requireUser();
  const invoiceId = formValue(formData, "invoiceId");
  const amount = decimalValue(formValue(formData, "amount"), "Payment amount");

  if (!invoiceId) {
    return { error: "Select an invoice for this payment." };
  }

  if (!amount.ok) {
    return { error: amount.error };
  }

  if (amount.value.lte(0)) {
    return { error: "Payment amount must be greater than 0." };
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      businessId: user.businessId,
      id: invoiceId,
      status: "finalized",
    },
  });

  if (!invoice) {
    return { error: "Payments can only be recorded against finalized invoices." };
  }

  if (invoice.balanceAmount.lte(0)) {
    return { error: "This invoice is already fully paid." };
  }

  if (amount.value.gt(invoice.balanceAmount)) {
    return {
      error: "Payment amount cannot be greater than the invoice balance.",
    };
  }

  const nextPaidAmount = invoice.paidAmount.plus(amount.value);
  const nextBalanceAmount = invoice.grandTotal.minus(nextPaidAmount);

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        amount: moneyString(amount.value),
        businessId: user.businessId,
        createdById: user.id,
        invoiceId,
        notes: formValue(formData, "notes") || null,
        paymentDate: dateValue(formValue(formData, "paymentDate")),
        paymentMethod: formValue(formData, "paymentMethod") || "cash",
      },
    });

    await tx.invoice.update({
      where: {
        id: invoiceId,
      },
      data: {
        balanceAmount: moneyString(nextBalanceAmount),
        paidAmount: moneyString(nextPaidAmount),
      },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/payments");
  revalidatePath(invoicePath(invoiceId));

  return { success: "Payment recorded." };
}
