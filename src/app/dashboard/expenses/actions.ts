"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { formValue } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { saveExpenseReceiptFile } from "@/app/_backend/lib/uploads";

export type ExpenseActionState = {
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

function nullableValue(formData: FormData, key: string) {
  return formValue(formData, key) || null;
}

function expensePath(expenseId: string) {
  return `/dashboard/expenses/${expenseId}`;
}

async function receiptUploadPath(formData: FormData) {
  const receipt = formData.get("receipt");

  if (!(receipt instanceof File) || receipt.size === 0) {
    return {
      path: null,
    };
  }

  const savedFile = await saveExpenseReceiptFile(receipt);

  if (!savedFile || "error" in savedFile) {
    return {
      error: savedFile?.error ?? "Could not save receipt attachment.",
    };
  }

  return {
    path: savedFile.path,
  };
}

export async function createExpense(
  _state: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const user = await requireUser();
  const category = formValue(formData, "category");
  const amount = decimalValue(formValue(formData, "amount"), "Expense amount");

  if (!category) {
    return { error: "Category is required." };
  }

  if (!amount.ok) {
    return { error: amount.error };
  }

  if (amount.value.lte(0)) {
    return { error: "Expense amount must be greater than 0." };
  }

  const receipt = await receiptUploadPath(formData);

  if ("error" in receipt) {
    return { error: receipt.error };
  }

  await prisma.expense.create({
    data: {
      attachmentPath: receipt.path,
      amount: moneyString(amount.value),
      businessId: user.businessId,
      category,
      createdById: user.id,
      date: dateValue(formValue(formData, "date")),
      notes: nullableValue(formData, "notes"),
      paymentMethod: nullableValue(formData, "paymentMethod"),
      vendor: nullableValue(formData, "vendor"),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");

  return { success: "Expense recorded." };
}

export async function updateExpense(
  _state: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const user = await requireUser();
  const expenseId = formValue(formData, "expenseId");
  const category = formValue(formData, "category");
  const amount = decimalValue(formValue(formData, "amount"), "Expense amount");

  if (!expenseId) {
    return { error: "Expense id is required." };
  }

  if (!category) {
    return { error: "Category is required." };
  }

  if (!amount.ok) {
    return { error: amount.error };
  }

  if (amount.value.lte(0)) {
    return { error: "Expense amount must be greater than 0." };
  }

  const expense = await prisma.expense.findFirst({
    where: {
      businessId: user.businessId,
      id: expenseId,
    },
  });

  if (!expense) {
    return { error: "Expense was not found." };
  }

  const receipt = await receiptUploadPath(formData);

  if ("error" in receipt) {
    return { error: receipt.error };
  }

  const data: Prisma.ExpenseUpdateInput = {
    amount: moneyString(amount.value),
    category,
    date: dateValue(formValue(formData, "date")),
    notes: nullableValue(formData, "notes"),
    paymentMethod: nullableValue(formData, "paymentMethod"),
    vendor: nullableValue(formData, "vendor"),
  };

  if (receipt.path) {
    data.attachmentPath = receipt.path;
  }

  await prisma.expense.update({
    data,
    where: {
      id: expenseId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");
  revalidatePath(expensePath(expenseId));

  return { success: "Expense updated." };
}

export async function archiveExpense(formData: FormData) {
  const user = await requireUser();
  const expenseId = formValue(formData, "expenseId");

  if (!expenseId) {
    return;
  }

  const expense = await prisma.expense.findFirst({
    where: {
      businessId: user.businessId,
      id: expenseId,
    },
  });

  if (!expense) {
    return;
  }

  await prisma.expense.update({
    data: {
      status: "archived",
    },
    where: {
      id: expenseId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");
  revalidatePath(expensePath(expenseId));
}
