"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { formValue } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { extractImportFileContent } from "@/app/_backend/lib/import-file-extraction";
import {
  buildInitialImportedDocumentSeeds,
  documentTypes,
  type DocumentType,
  type ImportType,
  importTypes,
  isDocumentType,
  isImportType,
  mappedFieldsByImportType,
} from "@/app/_backend/lib/imports";
import { saveImportSourceFile } from "@/app/_backend/lib/uploads";

export type ImportActionState = {
  error?: string;
  success?: string;
};

const fieldStatuses = ["extracted", "needs_review", "reviewed", "ignored"];
const importRecordTypes = [
  "customers",
  "products",
  "invoices",
  "expenses",
  "payments",
  "inventory",
];
const inventoryMovementTypes = ["stock_in", "stock_out", "adjustment"];

type ParsedImportDecimal =
  | {
      error?: never;
      value: string;
    }
  | {
      error: string;
      value?: never;
};

function fieldStatus(value: string) {
  return fieldStatuses.includes(value) ? value : "needs_review";
}

function canonicalFieldName(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function normalizedMatchText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(pvt|private|ltd|limited|llc|inc|co|company)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return right.length;
  }

  if (!right) {
    return left.length;
  }

  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const currentRow = [leftIndex + 1];

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertCost = currentRow[rightIndex] + 1;
      const deleteCost = previousRow[rightIndex + 1] + 1;
      const replaceCost =
        previousRow[rightIndex] +
        (left[leftIndex] === right[rightIndex] ? 0 : 1);

      currentRow.push(Math.min(insertCost, deleteCost, replaceCost));
    }

    previousRow.splice(0, previousRow.length, ...currentRow);
  }

  return previousRow[right.length] ?? 0;
}

function textSimilarity(leftValue: string | null | undefined, rightValue: string | null | undefined) {
  const left = normalizedMatchText(leftValue);
  const right = normalizedMatchText(rightValue);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.includes(right) || right.includes(left)) {
    return 0.9;
  }

  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  const sharedTokens = [...leftTokens].filter((token) => rightTokens.has(token));
  const tokenScore =
    (sharedTokens.length * 2) / Math.max(leftTokens.size + rightTokens.size, 1);
  const distance = levenshteinDistance(left, right);
  const editScore = 1 - distance / Math.max(left.length, right.length, 1);

  return Math.max(tokenScore, editScore);
}

function percentScore(score: number) {
  return `${Math.round(score * 100)}%`;
}

function normalizedValue(value: string | null) {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue || null;
}

function normalizedEmail(value: string | null) {
  return normalizedValue(value)?.toLowerCase() ?? null;
}

function decimalImportValue(
  value: string | null,
  label: string,
  {
    allowNegative = false,
    fallback = "0",
  }: {
    allowNegative?: boolean;
    fallback?: string;
  } = {},
): ParsedImportDecimal {
  const rawValue = (value ?? "").trim().replace(/,/g, "");

  if (!rawValue) {
    return { value: fallback };
  }

  const pattern = allowNegative ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/;

  if (!pattern.test(rawValue)) {
    return {
      error: `${label} must be a valid amount with up to 2 decimals.`,
    };
  }

  return { value: rawValue };
}

function wholeNumberImportValue(
  value: string | null,
  label: string,
  fallback = "0",
): ParsedImportDecimal {
  const rawValue = (value ?? "").trim().replace(/,/g, "");

  if (!rawValue) {
    return { value: fallback };
  }

  if (!/^\d+(\.0{1,2})?$/.test(rawValue)) {
    return {
      error: `${label} must be a whole number.`,
    };
  }

  return { value: rawValue };
}

function positiveWholeNumberImportValue(
  value: string | null,
  label: string,
  fallback: string,
): ParsedImportDecimal {
  const parsedValue = wholeNumberImportValue(value, label, fallback);

  if ("error" in parsedValue) {
    return parsedValue;
  }

  if (new Prisma.Decimal(parsedValue.value).lte(0)) {
    return {
      error: `${label} must be greater than 0.`,
    };
  }

  return parsedValue;
}

function dateImportValue(value: string | null) {
  const rawValue = normalizedValue(value);

  if (!rawValue) {
    return null;
  }

  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? `${rawValue}T00:00:00`
    : rawValue;
  const date = new Date(normalizedDate);

  return Number.isNaN(date.getTime()) ? null : date;
}

function moneyString(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2).toFixed(2);
}

function decimalDifference(left: Prisma.Decimal, right: Prisma.Decimal) {
  return left.minus(right).abs();
}

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { end, start };
}

async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  prefix: string,
  startingNumber: number,
) {
  const invoiceCount = await tx.invoice.count({
    where: {
      businessId,
    },
  });
  let nextNumber = startingNumber + invoiceCount;

  while (true) {
    const invoiceNumber = `${prefix}-${String(nextNumber).padStart(5, "0")}`;
    const existingInvoice = await tx.invoice.findUnique({
      where: {
        businessId_invoiceNumber: {
          businessId,
          invoiceNumber,
        },
      },
    });

    if (!existingInvoice) {
      return invoiceNumber;
    }

    nextNumber += 1;
  }
}

function mappedFieldForSource(
  sourceLabel: string,
  allowedMappedFields: string[],
  mappingBySource: Map<string, string>,
) {
  const savedMapping = mappingBySource.get(sourceLabel);

  if (savedMapping && allowedMappedFields.includes(savedMapping)) {
    return savedMapping;
  }

  const canonicalSource = canonicalFieldName(sourceLabel);

  return (
    allowedMappedFields.find(
      (field) => canonicalFieldName(field) === canonicalSource,
    ) ?? null
  );
}

function mappedValuesForDocument({
  allowedMappedFields,
  fields,
  mappingBySource,
}: {
  allowedMappedFields: string[];
  fields: Array<{
    correctedValue: string | null;
    extractedValue: string | null;
    fieldName: string;
    status: string;
  }>;
  mappingBySource: Map<string, string>;
}) {
  return fields.reduce<Record<string, string>>((currentValues, field) => {
    if (
      field.status === "ignored" ||
      field.fieldName.startsWith("source_") ||
      field.fieldName === "extracted_text_preview"
    ) {
      return currentValues;
    }

    const mappedField = mappedFieldForSource(
      field.fieldName,
      allowedMappedFields,
      mappingBySource,
    );
    const value = normalizedValue(field.correctedValue ?? field.extractedValue);

    if (!mappedField || !value) {
      return currentValues;
    }

    currentValues[mappedField] = value;
    return currentValues;
  }, {});
}

function customerDataFromValues(values: Record<string, string>) {
  const name = normalizedValue(values.name);
  const openingBalance = decimalImportValue(values.openingBalance, "Opening balance", {
    allowNegative: true,
  });

  if (!name) {
    return { error: "Customer name is required." };
  }

  if (openingBalance.error) {
    return { error: openingBalance.error };
  }

  return {
    data: {
      address: normalizedValue(values.address),
      businessName: normalizedValue(values.businessName),
      email: normalizedEmail(values.email),
      name,
      notes: normalizedValue(values.notes),
      openingBalance: openingBalance.value,
      phone: normalizedValue(values.phone),
      status: "active",
      taxNumber: normalizedValue(values.taxNumber),
    },
  };
}

function productDataFromValues(values: Record<string, string>) {
  const name = normalizedValue(values.name);
  const salePrice = decimalImportValue(values.salePrice, "Sale price");
  const costPrice = decimalImportValue(values.costPrice, "Cost price");
  const taxRate = decimalImportValue(values.taxRate, "Tax rate");
  const stockQuantity = wholeNumberImportValue(
    values.stockQuantity,
    "Stock quantity",
  );
  const lowStockAlert = wholeNumberImportValue(
    values.lowStockAlert,
    "Low-stock alert",
  );
  const type = values.type?.trim().toLowerCase() === "service"
    ? "service"
    : "product";

  if (!name) {
    return { error: "Product or service name is required." };
  }

  for (const parsedValue of [
    salePrice,
    costPrice,
    taxRate,
    stockQuantity,
    lowStockAlert,
  ]) {
    if (parsedValue.error) {
      return { error: parsedValue.error };
    }
  }

  return {
    data: {
      category: normalizedValue(values.category),
      costPrice: costPrice.value,
      description: normalizedValue(values.description),
      lowStockAlert: lowStockAlert.value,
      name,
      salePrice: salePrice.value,
      sku: normalizedValue(values.sku),
      status: "active",
      stockQuantity: type === "service" ? "0" : stockQuantity.value,
      taxRate: taxRate.value,
      type,
      unit: normalizedValue(values.unit),
    },
  };
}

function expenseDataFromValues(values: Record<string, string>) {
  const category = normalizedValue(values.category);
  const amount = decimalImportValue(values.amount, "Expense amount");
  const date = dateImportValue(values.date) ?? new Date();
  const rawStatus = normalizedValue(values.status)?.toLowerCase();
  const status = rawStatus === "archived" ? "archived" : "active";

  if (!category) {
    return { error: "Expense category is required." };
  }

  if ("error" in amount) {
    return { error: amount.error ?? "Expense amount is invalid." };
  }

  if (new Prisma.Decimal(amount.value).lte(0)) {
    return { error: "Expense amount must be greater than 0." };
  }

  return {
    data: {
      amount: amount.value,
      category,
      date,
      notes: normalizedValue(values.notes),
      paymentMethod: normalizedValue(values.paymentMethod),
      status,
      vendor: normalizedValue(values.vendor),
    },
  };
}

function paymentDataFromValues(values: Record<string, string>) {
  const invoiceNumber = normalizedValue(values.invoiceNumber);
  const amount = decimalImportValue(values.amount, "Payment amount");
  const paymentDate = dateImportValue(values.paymentDate) ?? new Date();

  if (!invoiceNumber) {
    return { error: "Invoice number is required." };
  }

  if ("error" in amount) {
    return { error: amount.error ?? "Payment amount is invalid." };
  }

  if (new Prisma.Decimal(amount.value).lte(0)) {
    return { error: "Payment amount must be greater than 0." };
  }

  return {
    data: {
      amount: amount.value,
      invoiceNumber,
      notes: normalizedValue(values.notes),
      paymentDate,
      paymentMethod: normalizedValue(values.paymentMethod) ?? "cash",
    },
  };
}

function inventoryMovementType(value: string | null) {
  const normalizedType = normalizedMatchText(value);
  const aliases: Record<string, string> = {
    add: "stock_in",
    in: "stock_in",
    inward: "stock_in",
    opening: "adjustment",
    out: "stock_out",
    outward: "stock_out",
    purchase: "stock_in",
    sale: "stock_out",
    stockadjustment: "adjustment",
    stockin: "stock_in",
    stockout: "stock_out",
    stocktake: "adjustment",
  };
  const mappedType =
    aliases[normalizedType.replace(/\s+/g, "")] ?? normalizedType.replace(/\s+/g, "_");

  return inventoryMovementTypes.includes(mappedType) ? mappedType : null;
}

function inventoryMovementDataFromValues(values: Record<string, string>) {
  const productName = normalizedValue(values.productName);
  const productSku = normalizedValue(values.productSku);
  const rawMovementType = normalizedValue(values.movementType);
  const movementType = rawMovementType
    ? inventoryMovementType(rawMovementType)
    : "adjustment";
  const quantity = wholeNumberImportValue(
    values.quantity,
    "Quantity",
    movementType === "adjustment" ? "0" : "0",
  );
  const unitCost = decimalImportValue(values.unitCost, "Unit cost");

  if (!productName && !productSku) {
    return { error: "Product name or SKU is required." };
  }

  if (!movementType) {
    return { error: "Movement type must be stock_in, stock_out, or adjustment." };
  }

  if ("error" in quantity) {
    return { error: quantity.error ?? "Quantity is invalid." };
  }

  if ("error" in unitCost) {
    return { error: unitCost.error ?? "Unit cost is invalid." };
  }

  if (movementType !== "adjustment" && new Prisma.Decimal(quantity.value).lte(0)) {
    return { error: "Quantity must be greater than 0." };
  }

  return {
    data: {
      movementType,
      notes: normalizedValue(values.notes),
      productName,
      productSku,
      quantity: quantity.value,
      unitCost: unitCost.value,
    },
  };
}

function invoiceGroupKey(values: Record<string, string>, fallback: string) {
  return normalizedValue(values.invoiceNumber) ?? fallback;
}

function sourceRowNumber(
  document: {
    fields: Array<{
      correctedValue: string | null;
      extractedValue: string | null;
      fieldName: string;
    }>;
  },
  fallback: number,
) {
  const rowNumberField = document.fields.find(
    (field) => field.fieldName === "source_row_number",
  );
  const rowNumber = Number(
    rowNumberField?.correctedValue ?? rowNumberField?.extractedValue,
  );

  return Number.isInteger(rowNumber) && rowNumber > 0 ? rowNumber : fallback;
}

async function createImportError(
  tx: Prisma.TransactionClient,
  {
    errorType = "apply_validation",
    fieldName,
    importJobId,
    message,
    originalValue,
    rowNumber,
  }: {
    errorType?: string;
    fieldName?: string;
    importJobId: string;
    message: string;
    originalValue?: string | null;
    rowNumber: number;
  },
) {
  await tx.importError.create({
    data: {
      errorType,
      fieldName,
      importJobId,
      message,
      originalValue,
      rowNumber,
    },
  });
}

type CustomerMatchRecord = {
  address: string | null;
  businessName: string | null;
  email: string | null;
  id: string;
  name: string;
  phone: string | null;
  taxNumber: string | null;
};

type ProductMatchRecord = {
  category: string | null;
  description: string | null;
  id: string;
  name: string;
  salePrice: Prisma.Decimal;
  sku: string | null;
  taxRate: Prisma.Decimal;
  type: string;
  unit: string | null;
};

type MatchResult<RecordType> =
  | {
      reason: string;
      record: RecordType;
      score: number;
      status: "matched" | "suggested";
    }
  | {
      reason: string;
      record?: never;
      score: number;
      status: "missing";
    };

function matchStatus(score: number): "matched" | "missing" | "suggested" {
  if (score >= 0.85) {
    return "matched";
  }

  if (score >= 0.65) {
    return "suggested";
  }

  return "missing";
}

async function findCustomerMatch(
  tx: Prisma.TransactionClient,
  {
    businessId,
    email,
    name,
    phone,
    taxNumber,
  }: {
    businessId: string;
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    taxNumber?: string | null;
  },
): Promise<MatchResult<CustomerMatchRecord>> {
  const customerEmail = normalizedEmail(email ?? null);
  const customerPhone = normalizedDigits(phone);
  const customerTaxNumber = normalizedMatchText(taxNumber);
  const customerName = normalizedValue(name ?? null);

  if (!customerEmail && !customerPhone && !customerTaxNumber && !customerName) {
    return {
      reason: "No customer name, email, phone, or tax number was provided.",
      score: 0,
      status: "missing",
    };
  }

  const candidates = await tx.customer.findMany({
    select: {
      address: true,
      businessName: true,
      email: true,
      id: true,
      name: true,
      phone: true,
      taxNumber: true,
    },
    where: {
      businessId,
      status: "active",
    },
  });
  const rankedCandidates = candidates
    .map((candidate) => {
      const emailScore =
        customerEmail && normalizedEmail(candidate.email) === customerEmail ? 1 : 0;
      const phoneScore =
        customerPhone &&
        customerPhone.length >= 7 &&
        normalizedDigits(candidate.phone) === customerPhone
          ? 1
          : 0;
      const taxScore =
        customerTaxNumber &&
        normalizedMatchText(candidate.taxNumber) === customerTaxNumber
          ? 0.98
          : 0;
      const nameScore = Math.max(
        textSimilarity(customerName, candidate.name),
        textSimilarity(customerName, candidate.businessName),
      );
      const score = Math.max(emailScore, phoneScore, taxScore, nameScore);
      const reason =
        emailScore === score && emailScore > 0
          ? "email"
          : phoneScore === score && phoneScore > 0
            ? "phone"
            : taxScore === score && taxScore > 0
              ? "tax number"
              : "name similarity";

      return {
        candidate,
        reason,
        score,
      };
    })
    .sort((left, right) => right.score - left.score);
  const bestCandidate = rankedCandidates[0];

  if (!bestCandidate) {
    return {
      reason: "No active customers exist yet.",
      score: 0,
      status: "missing",
    };
  }

  const status = matchStatus(bestCandidate.score);

  if (status === "missing") {
    return {
      reason: "No close customer match was found.",
      score: bestCandidate.score,
      status,
    };
  }

  return {
    reason: bestCandidate.reason,
    record: bestCandidate.candidate,
    score: bestCandidate.score,
    status,
  };
}

async function findProductMatch(
  tx: Prisma.TransactionClient,
  {
    businessId,
    category,
    name,
    sku,
  }: {
    businessId: string;
    category?: string | null;
    name?: string | null;
    sku?: string | null;
  },
): Promise<MatchResult<ProductMatchRecord>> {
  const productSku = normalizedMatchText(sku);
  const productName = normalizedValue(name ?? null);

  if (!productSku && !productName) {
    return {
      reason: "No product name or SKU was provided.",
      score: 0,
      status: "missing",
    };
  }

  const candidates = await tx.product.findMany({
    select: {
      category: true,
      description: true,
      id: true,
      name: true,
      salePrice: true,
      sku: true,
      taxRate: true,
      type: true,
      unit: true,
    },
    where: {
      businessId,
      status: "active",
    },
  });
  const rankedCandidates = candidates
    .map((candidate) => {
      const skuScore =
        productSku && normalizedMatchText(candidate.sku) === productSku ? 1 : 0;
      const nameScore = textSimilarity(productName, candidate.name);
      const categoryBonus =
        category != null && candidate.category
          ? textSimilarity(normalizedValue(category), candidate.category) * 0.12
          : 0;
      const baseScore = Math.max(skuScore, nameScore);
      const score = Math.min(baseScore + categoryBonus, 1);
      const reason =
        skuScore === baseScore && skuScore > 0
          ? "SKU"
          : categoryBonus > 0.05
            ? "name + category"
            : "name similarity";

      return {
        candidate,
        reason,
        score,
      };
    })
    .sort((left, right) => right.score - left.score);
  const bestCandidate = rankedCandidates[0];

  if (!bestCandidate) {
    return {
      reason: "No active products or services exist yet.",
      score: 0,
      status: "missing",
    };
  }

  const status = matchStatus(bestCandidate.score);

  if (status === "missing") {
    return {
      reason: "No close product/service match was found.",
      score: bestCandidate.score,
      status,
    };
  }

  return {
    reason: bestCandidate.reason,
    record: bestCandidate.candidate,
    score: bestCandidate.score,
    status,
  };
}

async function findDuplicateInvoice(
  tx: Prisma.TransactionClient,
  {
    businessId,
    customerId,
    grandTotal,
    importedInvoiceNumber,
    invoiceDate,
  }: {
    businessId: string;
    customerId: string;
    grandTotal: Prisma.Decimal;
    importedInvoiceNumber: string | null;
    invoiceDate: Date | null;
  },
) {
  if (importedInvoiceNumber) {
    const exactDuplicate = await tx.invoice.findUnique({
      where: {
        businessId_invoiceNumber: {
          businessId,
          invoiceNumber: importedInvoiceNumber,
        },
      },
    });

    if (exactDuplicate) {
      return {
        fieldName: "invoiceNumber",
        message: `Duplicate invoice number: ${importedInvoiceNumber} already exists.`,
        originalValue: importedInvoiceNumber,
      };
    }
  }

  if (!invoiceDate) {
    return null;
  }

  const { end, start } = dayRange(invoiceDate);
  const sameDayInvoices = await tx.invoice.findMany({
    select: {
      grandTotal: true,
      invoiceNumber: true,
    },
    where: {
      businessId,
      customerId,
      invoiceDate: {
        gte: start,
        lte: end,
      },
    },
  });
  const amountDuplicate = sameDayInvoices.find((invoice) =>
    decimalDifference(invoice.grandTotal, grandTotal).lte(0.01),
  );

  if (!amountDuplicate) {
    return null;
  }

  return {
    fieldName: "grandTotal",
    message: `Possible duplicate invoice: ${amountDuplicate.invoiceNumber} has the same customer, invoice date, and total.`,
    originalValue: moneyString(grandTotal),
  };
}

async function findDuplicateExpense(
  tx: Prisma.TransactionClient,
  {
    amount,
    businessId,
    category,
    date,
    vendor,
  }: {
    amount: Prisma.Decimal;
    businessId: string;
    category: string;
    date: Date;
    vendor?: string | null;
  },
) {
  const { end, start } = dayRange(date);
  const categoryText = normalizedMatchText(category);
  const vendorText = normalizedMatchText(vendor);
  const sameDayExpenses = await tx.expense.findMany({
    select: {
      amount: true,
      category: true,
      vendor: true,
    },
    where: {
      businessId,
      date: {
        gte: start,
        lte: end,
      },
      status: "active",
    },
  });
  const duplicateExpense = sameDayExpenses.find((expense) => {
    const sameAmount = decimalDifference(expense.amount, amount).lte(0.01);
    const sameCategory = normalizedMatchText(expense.category) === categoryText;
    const sameVendor =
      !vendorText || normalizedMatchText(expense.vendor) === vendorText;

    return sameAmount && sameCategory && sameVendor;
  });

  if (!duplicateExpense) {
    return null;
  }

  return {
    fieldName: "amount",
    message: `Possible duplicate expense: ${duplicateExpense.category} with the same date and amount already exists.`,
    originalValue: moneyString(amount),
  };
}

function importedTotalValidationMessage(
  values: Record<string, string>,
  {
    discountTotal,
    grandTotal,
    subtotal,
    taxTotal,
  }: {
    discountTotal: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
  },
) {
  const checks = [
    {
      fieldName: "subtotal",
      label: "Subtotal",
      calculatedValue: subtotal,
      importedValue: values.subtotal,
    },
    {
      fieldName: "discountTotal",
      label: "Discount total",
      calculatedValue: discountTotal,
      importedValue: values.discountTotal,
    },
    {
      fieldName: "taxTotal",
      label: "Tax total",
      calculatedValue: taxTotal,
      importedValue: values.taxTotal,
    },
    {
      fieldName: "grandTotal",
      label: "Grand total",
      calculatedValue: grandTotal,
      importedValue: values.grandTotal,
    },
  ];

  for (const check of checks) {
    if (!normalizedValue(check.importedValue ?? null)) {
      continue;
    }

    const parsedValue = decimalImportValue(check.importedValue, check.label);

    if ("error" in parsedValue) {
      return {
        fieldName: check.fieldName,
        message: parsedValue.error ?? `${check.label} is invalid.`,
        originalValue: check.importedValue,
      };
    }

    const importedValue = new Prisma.Decimal(parsedValue.value);

    if (decimalDifference(importedValue, check.calculatedValue).gt(0.01)) {
      return {
        fieldName: check.fieldName,
        message: `${check.label} mismatch: imported ${moneyString(
          importedValue,
        )}, calculated ${moneyString(check.calculatedValue)}.`,
        originalValue: check.importedValue,
      };
    }
  }

  return null;
}

async function applyInvoiceDocuments(
  tx: Prisma.TransactionClient,
  {
    allowedMappedFields,
    businessId,
    createdById,
    documents,
    forceImport,
    importJobId,
    mappingBySource,
  }: {
    allowedMappedFields: string[];
    businessId: string;
    createdById: string;
    documents: Array<{
      id: string;
      fields: Array<{
        correctedValue: string | null;
        extractedValue: string | null;
        fieldName: string;
        status: string;
      }>;
      status: string;
    }>;
    forceImport: boolean;
    importJobId: string;
    mappingBySource: Map<string, string>;
  },
) {
  const business = await tx.business.findUniqueOrThrow({
    where: {
      id: businessId,
    },
  });
  const groupedRows = new Map<
    string,
    Array<{
      document: (typeof documents)[number];
      rowNumber: number;
      values: Record<string, string>;
    }>
  >();
  let createdCount = 0;
  let errorCount = 0;

  for (const [index, document] of documents.entries()) {
    const rowNumber = sourceRowNumber(document, index + 1);

    if (document.status !== "reviewed") {
      errorCount += 1;
      await createImportError(tx, {
        importJobId,
        message: "Document must be reviewed before it can be applied.",
        rowNumber,
      });
      await tx.importedDocument.update({
        data: {
          status: "needs_review",
        },
        where: {
          id: document.id,
        },
      });
      continue;
    }

    const values = mappedValuesForDocument({
      allowedMappedFields,
      fields: document.fields,
      mappingBySource,
    });
    const groupKey = invoiceGroupKey(values, `document:${document.id}`);
    const currentRows = groupedRows.get(groupKey) ?? [];

    currentRows.push({
      document,
      rowNumber,
      values,
    });
    groupedRows.set(groupKey, currentRows);
  }

  for (const [groupKey, rows] of groupedRows.entries()) {
    const firstRow = rows[0];

    if (!firstRow) {
      continue;
    }

    const customerName = normalizedValue(firstRow.values.customerName);
    const customerEmail = normalizedEmail(firstRow.values.customerEmail);
    const customerPhone = normalizedValue(firstRow.values.customerPhone);

    if (!customerName && !customerEmail && !customerPhone) {
      errorCount += 1;

      for (const row of rows) {
        await createImportError(tx, {
          fieldName: "customerName",
          importJobId,
          message:
            "Customer match is required. Add customerName, customerEmail, or customerPhone.",
          originalValue: firstRow.values.customerName,
          rowNumber: row.rowNumber,
        });
        await tx.importedDocument.update({
          data: {
            status: "failed",
          },
          where: {
            id: row.document.id,
          },
        });
      }

      continue;
    }

    const customerMatch = await findCustomerMatch(tx, {
      businessId,
      email: customerEmail,
      name: customerName,
      phone: customerPhone,
    });

    if (customerMatch.status === "suggested") {
      errorCount += 1;

      for (const row of rows) {
        await createImportError(tx, {
          errorType: "possible_customer_match",
          fieldName: "customerName",
          importJobId,
          message: `Possible customer match: ${customerMatch.record.name} (${percentScore(
            customerMatch.score,
          )} via ${customerMatch.reason}). Confirm by correcting the customer name/email/phone, or create the customer first.`,
          originalValue: customerName ?? customerEmail ?? customerPhone,
          rowNumber: row.rowNumber,
        });
        await tx.importedDocument.update({
          data: {
            status: "failed",
          },
          where: {
            id: row.document.id,
          },
        });
      }

      continue;
    }

    if (customerMatch.status === "missing") {
      errorCount += 1;

      for (const row of rows) {
        await createImportError(tx, {
          errorType: "customer_match_required",
          fieldName: "customerName",
          importJobId,
          message: `Customer could not be matched. ${customerMatch.reason} Create or import this customer first.`,
          originalValue: customerName ?? customerEmail ?? customerPhone,
          rowNumber: row.rowNumber,
        });
        await tx.importedDocument.update({
          data: {
            status: "failed",
          },
          where: {
            id: row.document.id,
          },
        });
      }

      continue;
    }

    const customer = customerMatch.record;
    const importedInvoiceNumber = groupKey.startsWith("document:")
      ? null
      : groupKey;

    const invoiceItems = [];
    let subtotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    let groupHasError = false;

    for (const [lineIndex, row] of rows.entries()) {
      const productName = normalizedValue(row.values.productName);
      const productSku = normalizedValue(row.values.productSku);

      if (!productName && !productSku) {
        errorCount += 1;
        groupHasError = true;
        await createImportError(tx, {
          fieldName: "productName",
          importJobId,
          message:
            "Product match is required. Add productName or productSku for this line.",
          originalValue: productName ?? productSku,
          rowNumber: row.rowNumber,
        });
        await tx.importedDocument.update({
          data: {
            status: "failed",
          },
          where: {
            id: row.document.id,
          },
        });
        continue;
      }

      const productMatch = await findProductMatch(tx, {
        businessId,
        name: productName,
        sku: productSku,
      });

      if (productMatch.status === "suggested") {
        errorCount += 1;
        groupHasError = true;
        await createImportError(tx, {
          errorType: "possible_product_match",
          fieldName: productSku ? "productSku" : "productName",
          importJobId,
          message: `Possible product/service match: ${
            productMatch.record.name
          } (${percentScore(productMatch.score)} via ${
            productMatch.reason
          }). Confirm by correcting the product name/SKU, or create the item first.`,
          originalValue: productSku ?? productName,
          rowNumber: row.rowNumber,
        });
        await tx.importedDocument.update({
          data: {
            status: "failed",
          },
          where: {
            id: row.document.id,
          },
        });
        continue;
      }

      if (productMatch.status === "missing") {
        errorCount += 1;
        groupHasError = true;
        await createImportError(tx, {
          errorType: "product_match_required",
          fieldName: productSku ? "productSku" : "productName",
          importJobId,
          message: `Product/service could not be matched. ${productMatch.reason} Create or import this item first.`,
          originalValue: productSku ?? productName,
          rowNumber: row.rowNumber,
        });
        await tx.importedDocument.update({
          data: {
            status: "failed",
          },
          where: {
            id: row.document.id,
          },
        });
        continue;
      }

      const product = productMatch.record;
      const quantity = positiveWholeNumberImportValue(
        row.values.quantity,
        "Quantity",
        "1",
      );
      const unitPrice = decimalImportValue(row.values.unitPrice, "Unit price", {
        fallback: product.salePrice.toString(),
      });
      const discount = decimalImportValue(row.values.discount, "Discount");
      const taxRate = decimalImportValue(row.values.taxRate, "Tax rate", {
        fallback: product.taxRate.toString(),
      });

      const parsedValueError = [quantity, unitPrice, discount, taxRate].find(
        (parsedValue) => "error" in parsedValue,
      );

      if (parsedValueError && "error" in parsedValueError) {
        errorCount += 1;
        groupHasError = true;
        await createImportError(tx, {
          importJobId,
          message:
            parsedValueError.error ?? "Imported numeric value is invalid.",
          rowNumber: row.rowNumber,
        });
        await tx.importedDocument.update({
          data: {
            status: "failed",
          },
          where: {
            id: row.document.id,
          },
        });
        continue;
      }

      if (
        groupHasError ||
        "error" in quantity ||
        "error" in unitPrice ||
        "error" in discount ||
        "error" in taxRate
      ) {
        continue;
      }

      const quantityValue = new Prisma.Decimal(quantity.value);
      const unitPriceValue = new Prisma.Decimal(unitPrice.value);
      const grossLineTotal = quantityValue.mul(unitPriceValue);
      const discountValue = new Prisma.Decimal(discount.value).gt(grossLineTotal)
        ? grossLineTotal
        : new Prisma.Decimal(discount.value);
      const taxableAmount = grossLineTotal.minus(discountValue);
      const taxRateValue = new Prisma.Decimal(taxRate.value);
      const taxAmount = taxableAmount.mul(taxRateValue).div(100);
      const lineTotal = taxableAmount.plus(taxAmount);

      subtotal = subtotal.plus(grossLineTotal);
      discountTotal = discountTotal.plus(discountValue);
      taxTotal = taxTotal.plus(taxAmount);
      invoiceItems.push({
        description: normalizedValue(row.values.itemDescription) ?? product.description,
        discount: moneyString(discountValue),
        itemName: product.name,
        lineTotal: moneyString(lineTotal),
        productId: product.id,
        quantity: moneyString(quantityValue),
        sortOrder: lineIndex,
        taxAmount: moneyString(taxAmount),
        taxRate: moneyString(taxRateValue),
        unit: product.unit,
        unitPrice: moneyString(unitPriceValue),
      });
    }

    if (groupHasError || invoiceItems.length !== rows.length) {
      for (const row of rows) {
        const currentDocument = await tx.importedDocument.findUnique({
          select: {
            status: true,
          },
          where: {
            id: row.document.id,
          },
        });

        if (currentDocument?.status !== "failed") {
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: row.document.id,
            },
          });
        }
      }

      continue;
    }

    const grandTotal = subtotal.minus(discountTotal).plus(taxTotal);
    const importedTotalMismatch = importedTotalValidationMessage(
      firstRow.values,
      {
        discountTotal,
        grandTotal,
        subtotal,
        taxTotal,
      },
    );

    if (importedTotalMismatch) {
      errorCount += rows.length;

      for (const row of rows) {
        await createImportError(tx, {
          errorType: "total_mismatch",
          fieldName: importedTotalMismatch.fieldName,
          importJobId,
          message: importedTotalMismatch.message,
          originalValue: importedTotalMismatch.originalValue,
          rowNumber: row.rowNumber,
        });
        await tx.importedDocument.update({
          data: {
            status: "failed",
          },
          where: {
            id: row.document.id,
          },
        });
      }

      continue;
    }

    const invoiceDate = dateImportValue(firstRow.values.invoiceDate);
    if (!forceImport) {
      const duplicateInvoice = await findDuplicateInvoice(tx, {
        businessId,
        customerId: customer.id,
        grandTotal,
        importedInvoiceNumber,
        invoiceDate,
      });

      if (duplicateInvoice) {
        errorCount += rows.length;

        for (const row of rows) {
          await createImportError(tx, {
            errorType: "duplicate_invoice",
            fieldName: duplicateInvoice.fieldName,
            importJobId,
            message: duplicateInvoice.message,
            originalValue: duplicateInvoice.originalValue,
            rowNumber: row.rowNumber,
          });
          await tx.importedDocument.update({
            data: { status: "failed" },
            where: { id: row.document.id },
          });
        }

        continue;
      }
    }

    const invoiceNumber =
      importedInvoiceNumber ??
      (await nextInvoiceNumber(
        tx,
        businessId,
        business.invoicePrefix,
        business.invoiceStartingNumber,
      ));

    await tx.invoice.create({
      data: {
        balanceAmount: moneyString(grandTotal),
        businessId,
        createdById,
        customerId: customer.id,
        discountTotal: moneyString(discountTotal),
        dueDate: dateImportValue(firstRow.values.dueDate),
        grandTotal: moneyString(grandTotal),
        invoiceDate: invoiceDate ?? new Date(),
        invoiceNumber,
        notes: normalizedValue(firstRow.values.notes),
        paidAmount: "0",
        status: "draft",
        subtotal: moneyString(subtotal),
        taxTotal: moneyString(taxTotal),
        terms: normalizedValue(firstRow.values.terms),
        items: {
          create: invoiceItems,
        },
      },
    });

    createdCount += 1;

    for (const row of rows) {
      await tx.importedDocument.update({
        data: {
          status: "imported",
        },
        where: {
          id: row.document.id,
        },
      });
    }
  }

  return {
    createdCount,
    errorCount,
    totalRows: groupedRows.size,
  };
}

async function processSingleImportFile(
  file: File,
  {
    businessId,
    createdById,
    documentType,
    importType,
  }: {
    businessId: string;
    createdById: string;
    documentType: DocumentType;
    importType: ImportType;
  },
) {
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const savedFile = await saveImportSourceFile(file, fileBuffer);

  if (!savedFile || "error" in savedFile) {
    return { error: savedFile?.error ?? `Could not save ${file.name}.` };
  }

  const existingHashDoc = await prisma.importedDocument.findFirst({
    select: { importJobId: true },
    where: { businessId, fileHash: savedFile.hash },
  });

  const extraction = await extractImportFileContent({
    fileBuffer,
    fileName: file.name,
    fileType: file.type || "unknown",
  });
  const documentSeeds = buildInitialImportedDocumentSeeds({
    documentType,
    extractionConfidence: extraction.confidence,
    extractionSource: extraction.source,
    extractionWarning: extraction.warning,
    fileBuffer,
    fileName: file.name,
    fileSize: savedFile.size,
    fileType: file.type || "unknown",
    importType,
    textContent: extraction.textContent,
  });
  const extractedFields = documentSeeds.flatMap((document) => document.fields);
  const extractedCount = extractedFields.filter(
    (field) => field.status === "extracted",
  ).length;
  const needsReviewCount = extractedFields.length - extractedCount;

  const importJob = await prisma.importJob.create({
    data: {
      businessId,
      createdById,
      failedRows: needsReviewCount,
      fileName: file.name,
      fileType: file.type || "unknown",
      importType,
      status: "needs_review",
      successfulRows: extractedCount,
      totalRows: extractedFields.length,
      documents: {
        create: documentSeeds.map((documentSeed) => ({
          businessId,
          confidenceScore: documentSeed.confidenceScore.toString(),
          documentType,
          extractedText: documentSeed.extractedText,
          fileHash: savedFile.hash,
          filePath: savedFile.path,
          originalFileName: documentSeed.originalFileName,
          parsedJson: documentSeed.parsedJson,
          status: "needs_review",
          fields: {
            create: documentSeed.fields.map((field) => ({
              confidence: field.confidence.toString(),
              extractedValue: field.extractedValue,
              fieldName: field.fieldName,
              status: field.status,
            })),
          },
        })),
      },
    },
  });

  if (existingHashDoc) {
    await prisma.importError.create({
      data: {
        errorType: "duplicate_file",
        importJobId: importJob.id,
        message:
          "This file was previously imported in another job. Review carefully before applying to avoid duplicate records.",
      },
    });
  }

  return { jobId: importJob.id };
}

export async function createImportJob(
  _state: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const user = await requireUser();
  const importType = formValue(formData, "importType");
  const documentType = formValue(formData, "documentType");
  const rawFiles = formData.getAll("importFile");
  const files = rawFiles.filter(
    (f): f is File => f instanceof File && f.size > 0,
  );

  if (!isImportType(importType)) {
    return { error: `Select a valid import type: ${importTypes.join(", ")}.` };
  }

  if (!isDocumentType(documentType)) {
    return { error: `Select a valid document type: ${documentTypes.join(", ")}.` };
  }

  if (files.length === 0) {
    return { error: "Choose at least one file to import." };
  }

  const context = {
    businessId: user.businessId,
    createdById: user.id,
    documentType: documentType as DocumentType,
    importType: importType as ImportType,
  };

  if (files.length === 1 && files[0]) {
    const result = await processSingleImportFile(files[0], context);
    if ("error" in result) return { error: result.error };
    revalidatePath("/dashboard/imports");
    redirect(`/dashboard/imports/${result.jobId}`);
  }

  const errors: string[] = [];
  for (const file of files) {
    const result = await processSingleImportFile(file, context);
    if ("error" in result) errors.push(result.error ?? file.name);
  }

  revalidatePath("/dashboard/imports");

  if (errors.length > 0) {
    redirect(
      `/dashboard/imports?error=${encodeURIComponent(
        `${files.length - errors.length} of ${files.length} files created successfully. Errors: ${errors.join("; ")}`,
      )}`,
    );
  }

  redirect("/dashboard/imports");
}

export async function updateExtractedFields(formData: FormData) {
  const user = await requireUser();
  const importJobId = formValue(formData, "importJobId");
  const documentId = formValue(formData, "documentId");
  const fieldIds = formData
    .getAll("fieldId")
    .filter((fieldId): fieldId is string => typeof fieldId === "string");

  if (!importJobId || !documentId || fieldIds.length === 0) {
    return;
  }

  const document = await prisma.importedDocument.findFirst({
    include: {
      fields: true,
      importJob: true,
    },
    where: {
      businessId: user.businessId,
      id: documentId,
      importJobId,
    },
  });

  if (!document) {
    return;
  }

  const allowedMappedFields =
    mappedFieldsByImportType[document.importJob.importType as keyof typeof mappedFieldsByImportType] ??
    [];
  const documentFieldsById = new Map(
    document.fields.map((field) => [field.id, field]),
  );

  await prisma.$transaction(async (tx) => {
    for (const fieldId of fieldIds) {
      const field = documentFieldsById.get(fieldId);

      if (!field) {
        continue;
      }

      const correctedValue =
        formValue(formData, `correctedValue:${fieldId}`) || null;
      const nextStatus = fieldStatus(formValue(formData, `status:${fieldId}`));
      const mappedField = formValue(formData, `mappedField:${fieldId}`);

      await tx.extractedField.update({
        data: {
          correctedValue,
          status: nextStatus,
        },
        where: {
          id: fieldId,
        },
      });

      if (mappedField && allowedMappedFields.includes(mappedField)) {
        await tx.documentFieldMapping.upsert({
          create: {
            businessId: user.businessId,
            confidence: field.confidence.toString(),
            mappedField,
            sourceLabel: field.fieldName,
            timesUsed: 1,
            lastUsedAt: new Date(),
          },
          update: {
            lastUsedAt: new Date(),
            timesUsed: {
              increment: 1,
            },
          },
          where: {
            businessId_sourceLabel_mappedField: {
              businessId: user.businessId,
              mappedField,
              sourceLabel: field.fieldName,
            },
          },
        });
      }
    }

    const updatedFields = await tx.extractedField.findMany({
      where: {
        documentId,
      },
    });
    const reviewedCount = updatedFields.filter(
      (field) => field.status === "reviewed" || field.status === "ignored",
    ).length;
    const nextStatus =
      reviewedCount === updatedFields.length ? "reviewed" : "needs_review";

    await tx.importedDocument.update({
      data: {
        parsedJson: JSON.stringify(
          updatedFields.reduce<Record<string, string | null>>(
            (currentFields, field) => {
              currentFields[field.fieldName] =
                field.correctedValue ?? field.extractedValue;
              return currentFields;
            },
            {},
          ),
        ),
        status: nextStatus,
      },
      where: {
        id: documentId,
      },
    });

    await tx.importJob.update({
      data: {
        failedRows: updatedFields.length - reviewedCount,
        status: nextStatus,
        successfulRows: reviewedCount,
      },
      where: {
        id: importJobId,
      },
    });
  });

  revalidatePath("/dashboard/imports");
  revalidatePath(`/dashboard/imports/${importJobId}`);
}

export async function skipImportJob(formData: FormData) {
  const user = await requireUser();
  const importJobId = formValue(formData, "importJobId");

  if (!importJobId) {
    return;
  }

  await prisma.importJob.updateMany({
    data: { status: "skipped" },
    where: { businessId: user.businessId, id: importJobId },
  });

  revalidatePath(`/dashboard/imports/${importJobId}`);
}

export async function applyReviewedImportJob(formData: FormData) {
  const user = await requireUser();
  const importJobId = formValue(formData, "importJobId");
  const forceImport = formValue(formData, "forceImport") === "true";

  if (!importJobId) {
    return;
  }

  const importJob = await prisma.importJob.findFirst({
    include: {
      documents: {
        include: {
          fields: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    where: {
      businessId: user.businessId,
      id: importJobId,
    },
  });

  if (
    !importJob ||
    importJob.status === "imported" ||
    importJob.status === "imported_with_errors"
  ) {
    return;
  }

  if (!importRecordTypes.includes(importJob.importType)) {
    await prisma.importError.create({
      data: {
        errorType: "unsupported_import_type",
        importJobId,
        message: "This import type is not supported for record creation yet.",
      },
    });
    revalidatePath(`/dashboard/imports/${importJobId}`);
    return;
  }

  if (importJob.status !== "reviewed") {
    await prisma.importError.create({
      data: {
        errorType: "not_reviewed",
        importJobId,
        message: "Review all extracted fields before applying this import job.",
      },
    });
    revalidatePath(`/dashboard/imports/${importJobId}`);
    return;
  }

  const mappings = await prisma.documentFieldMapping.findMany({
    orderBy: {
      timesUsed: "desc",
    },
    where: {
      businessId: user.businessId,
    },
  });
  const mappingBySource = new Map(
    mappings.map((mapping) => [mapping.sourceLabel, mapping.mappedField]),
  );
  const allowedMappedFields =
    mappedFieldsByImportType[
      importJob.importType as keyof typeof mappedFieldsByImportType
    ] ?? [];

  const result = await prisma.$transaction(async (tx) => {
    let createdCount = 0;
    let errorCount = 0;

    await tx.importError.deleteMany({
      where: {
        importJobId,
      },
    });

    if (importJob.importType === "invoices") {
      const invoiceResult = await applyInvoiceDocuments(tx, {
        allowedMappedFields,
        businessId: user.businessId,
        createdById: user.id,
        documents: importJob.documents,
        forceImport,
        importJobId,
        mappingBySource,
      });
      const nextStatus =
        invoiceResult.errorCount === 0
          ? "imported"
          : invoiceResult.createdCount > 0
            ? "imported_with_errors"
            : "failed";

      await tx.importJob.update({
        data: {
          failedRows: invoiceResult.errorCount,
          status: nextStatus,
          successfulRows: invoiceResult.createdCount,
          totalRows: invoiceResult.totalRows,
        },
        where: {
          id: importJobId,
        },
      });

      return {
        createdCount: invoiceResult.createdCount,
        errorCount: invoiceResult.errorCount,
      };
    }

    for (const [index, document] of importJob.documents.entries()) {
      const rowNumber = sourceRowNumber(document, index + 1);

      if (document.status !== "reviewed") {
        errorCount += 1;
        await createImportError(tx, {
          importJobId,
          message: "Document must be reviewed before it can be applied.",
          rowNumber,
        });
        await tx.importedDocument.update({
          data: {
            status: "needs_review",
          },
          where: {
            id: document.id,
          },
        });
        continue;
      }

      const values = mappedValuesForDocument({
        allowedMappedFields,
        fields: document.fields,
        mappingBySource,
      });

      if (importJob.importType === "customers") {
        const customerData = customerDataFromValues(values);

        if ("error" in customerData) {
          errorCount += 1;
          await createImportError(tx, {
            fieldName: "name",
            importJobId,
            message: customerData.error ?? "Customer data is invalid.",
            originalValue: values.name,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        const duplicateCustomer = await findCustomerMatch(tx, {
          businessId: user.businessId,
          email: customerData.data.email,
          name: customerData.data.name,
          phone: customerData.data.phone,
          taxNumber: customerData.data.taxNumber,
        });

        if (duplicateCustomer.status !== "missing") {
          errorCount += 1;
          await createImportError(tx, {
            errorType:
              duplicateCustomer.status === "matched"
                ? "duplicate_customer"
                : "possible_customer_match",
            fieldName: "name",
            importJobId,
            message: `${
              duplicateCustomer.status === "matched"
                ? "Duplicate customer"
                : "Possible duplicate customer"
            }: ${duplicateCustomer.record.name} (${percentScore(
              duplicateCustomer.score,
            )} via ${duplicateCustomer.reason}).`,
            originalValue: customerData.data.name,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        await tx.customer.create({
          data: {
            ...customerData.data,
            businessId: user.businessId,
          },
        });
      }

      if (importJob.importType === "products") {
        const productData = productDataFromValues(values);

        if ("error" in productData) {
          errorCount += 1;
          await createImportError(tx, {
            fieldName: "name",
            importJobId,
            message: productData.error ?? "Product data is invalid.",
            originalValue: values.name,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        const duplicateProduct = await findProductMatch(tx, {
          businessId: user.businessId,
          category: productData.data.category,
          name: productData.data.name,
          sku: productData.data.sku,
        });

        if (duplicateProduct.status !== "missing") {
          errorCount += 1;
          await createImportError(tx, {
            errorType:
              duplicateProduct.status === "matched"
                ? "duplicate_product"
                : "possible_product_match",
            fieldName: productData.data.sku ? "sku" : "name",
            importJobId,
            message: `${
              duplicateProduct.status === "matched"
                ? "Duplicate item"
                : "Possible duplicate item"
            }: ${duplicateProduct.record.name} (${percentScore(
              duplicateProduct.score,
            )} via ${duplicateProduct.reason}).`,
            originalValue: productData.data.sku ?? productData.data.name,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        await tx.product.create({
          data: {
            ...productData.data,
            businessId: user.businessId,
          },
        });
      }

      if (importJob.importType === "expenses") {
        const expenseData = expenseDataFromValues(values);

        if ("error" in expenseData) {
          errorCount += 1;
          await createImportError(tx, {
            fieldName: "category",
            importJobId,
            message: expenseData.error ?? "Expense data is invalid.",
            originalValue: values.category,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        const expenseAmount = new Prisma.Decimal(expenseData.data.amount);
        if (!forceImport) {
          const duplicateExpense = await findDuplicateExpense(tx, {
            amount: expenseAmount,
            businessId: user.businessId,
            category: expenseData.data.category,
            date: expenseData.data.date,
            vendor: expenseData.data.vendor,
          });

          if (duplicateExpense) {
            errorCount += 1;
            await createImportError(tx, {
              errorType: "duplicate_expense",
              fieldName: duplicateExpense.fieldName,
              importJobId,
              message: duplicateExpense.message,
              originalValue: duplicateExpense.originalValue,
              rowNumber,
            });
            await tx.importedDocument.update({
              data: { status: "failed" },
              where: { id: document.id },
            });
            continue;
          }
        }

        await tx.expense.create({
          data: {
            ...expenseData.data,
            amount: moneyString(expenseAmount),
            attachmentPath:
              document.documentType === "receipt" ? document.filePath : null,
            businessId: user.businessId,
            createdById: user.id,
          },
        });
      }

      if (importJob.importType === "payments") {
        const paymentData = paymentDataFromValues(values);

        if ("error" in paymentData) {
          errorCount += 1;
          await createImportError(tx, {
            fieldName: "invoiceNumber",
            importJobId,
            message: paymentData.error ?? "Payment data is invalid.",
            originalValue: values.invoiceNumber,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        const invoice = await tx.invoice.findFirst({
          where: {
            businessId: user.businessId,
            invoiceNumber: paymentData.data.invoiceNumber,
            status: "finalized",
          },
        });

        if (!invoice) {
          errorCount += 1;
          await createImportError(tx, {
            errorType: "payment_invoice_required",
            fieldName: "invoiceNumber",
            importJobId,
            message:
              "Payment import requires a finalized invoice with this invoice number.",
            originalValue: paymentData.data.invoiceNumber,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        const paymentAmount = new Prisma.Decimal(paymentData.data.amount);

        if (invoice.balanceAmount.lte(0) || paymentAmount.gt(invoice.balanceAmount)) {
          errorCount += 1;
          await createImportError(tx, {
            fieldName: "amount",
            importJobId,
            message: "Payment amount cannot exceed the invoice balance.",
            originalValue: paymentData.data.amount,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        const nextPaidAmount = invoice.paidAmount.plus(paymentAmount);
        const nextBalanceAmount = invoice.grandTotal.minus(nextPaidAmount);

        await tx.payment.create({
          data: {
            amount: moneyString(paymentAmount),
            businessId: user.businessId,
            createdById: user.id,
            invoiceId: invoice.id,
            notes: paymentData.data.notes,
            paymentDate: paymentData.data.paymentDate,
            paymentMethod: paymentData.data.paymentMethod,
          },
        });
        await tx.invoice.update({
          data: {
            balanceAmount: moneyString(nextBalanceAmount),
            paidAmount: moneyString(nextPaidAmount),
          },
          where: {
            id: invoice.id,
          },
        });
      }

      if (importJob.importType === "inventory") {
        const movementData = inventoryMovementDataFromValues(values);

        if ("error" in movementData) {
          errorCount += 1;
          await createImportError(tx, {
            errorType: "inventory_product_required",
            fieldName: movementData.error?.includes("Product")
              ? "productName"
              : "quantity",
            importJobId,
            message: movementData.error ?? "Inventory stock data is invalid.",
            originalValue: values.productSku ?? values.productName,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        const productMatch = await findProductMatch(tx, {
          businessId: user.businessId,
          name: movementData.data.productName,
          sku: movementData.data.productSku,
        });

        if (productMatch.status === "suggested") {
          errorCount += 1;
          await createImportError(tx, {
            errorType: "possible_product_match",
            fieldName: movementData.data.productSku ? "productSku" : "productName",
            importJobId,
            message: `Possible product/service match: ${
              productMatch.record.name
            } (${percentScore(productMatch.score)} via ${
              productMatch.reason
            }). Confirm by correcting the product name/SKU, or create the item first.`,
            originalValue:
              movementData.data.productSku ?? movementData.data.productName,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        if (productMatch.status === "missing" || productMatch.record.type !== "product") {
          errorCount += 1;
          await createImportError(tx, {
            errorType: "inventory_product_required",
            fieldName: movementData.data.productSku ? "productSku" : "productName",
            importJobId,
            message:
              productMatch.status === "missing"
                ? `Product could not be matched. ${productMatch.reason} Create or import this item first.`
                : "Inventory stock imports require a product, not a service.",
            originalValue:
              movementData.data.productSku ?? movementData.data.productName,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        const product = await tx.product.findFirst({
          where: {
            businessId: user.businessId,
            id: productMatch.record.id,
            type: "product",
          },
        });

        if (!product) {
          errorCount += 1;
          await createImportError(tx, {
            errorType: "inventory_product_required",
            fieldName: "productName",
            importJobId,
            message: "Product was not found or is not stock tracked.",
            originalValue:
              movementData.data.productSku ?? movementData.data.productName,
            rowNumber,
          });
          await tx.importedDocument.update({
            data: {
              status: "failed",
            },
            where: {
              id: document.id,
            },
          });
          continue;
        }

        const quantity = new Prisma.Decimal(movementData.data.quantity);
        const currentStock = product.stockQuantity;
        let movementQuantity = quantity;
        let nextStock = currentStock;

        if (movementData.data.movementType === "stock_in") {
          nextStock = currentStock.plus(quantity);
        }

        if (movementData.data.movementType === "stock_out") {
          if (currentStock.lt(quantity)) {
            errorCount += 1;
            await createImportError(tx, {
              errorType: "insufficient_stock",
              fieldName: "quantity",
              importJobId,
              message: `Insufficient stock. ${product.name} has ${moneyString(
                currentStock,
              )} on hand.`,
              originalValue: movementData.data.quantity,
              rowNumber,
            });
            await tx.importedDocument.update({
              data: {
                status: "failed",
              },
              where: {
                id: document.id,
              },
            });
            continue;
          }

          movementQuantity = quantity.negated();
          nextStock = currentStock.minus(quantity);
        }

        if (movementData.data.movementType === "adjustment") {
          movementQuantity = quantity.minus(currentStock);
          nextStock = quantity;
        }

        await tx.product.update({
          data: {
            stockQuantity: moneyString(nextStock),
          },
          where: {
            id: product.id,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            businessId: user.businessId,
            notes: movementData.data.notes,
            productId: product.id,
            quantity: moneyString(movementQuantity),
            type: movementData.data.movementType,
            unitCost: moneyString(new Prisma.Decimal(movementData.data.unitCost)),
          },
        });
      }

      createdCount += 1;
      await tx.importedDocument.update({
        data: {
          status: "imported",
        },
        where: {
          id: document.id,
        },
      });
    }

    const nextStatus =
      errorCount === 0
        ? "imported"
        : createdCount > 0
          ? "imported_with_errors"
          : "failed";

    await tx.importJob.update({
      data: {
        failedRows: errorCount,
        status: nextStatus,
        successfulRows: createdCount,
        totalRows: importJob.documents.length,
      },
      where: {
        id: importJobId,
      },
    });

    return {
      createdCount,
      errorCount,
    };
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/imports");
  revalidatePath(`/dashboard/imports/${importJobId}`);

  if (importJob.importType === "customers" && result.createdCount > 0) {
    revalidatePath("/dashboard/customers");
  }

  if (importJob.importType === "products" && result.createdCount > 0) {
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/inventory");
  }

  if (importJob.importType === "invoices" && result.createdCount > 0) {
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/reports/receivables");
  }

  if (importJob.importType === "expenses" && result.createdCount > 0) {
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/reports/profit-loss");
  }

  if (importJob.importType === "payments" && result.createdCount > 0) {
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/reports/receivables");
  }

  if (importJob.importType === "inventory" && result.createdCount > 0) {
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/reports");
  }
}
