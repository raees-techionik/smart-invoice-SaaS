"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { formValue, normalizeEmail } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { parseInvoiceTemplateSettings } from "@/app/_backend/lib/invoice-templates";

export type InvoiceActionState = {
  error?: string;
  success?: string;
};

export type InvoiceEmailActionState = {
  error?: string;
  success?: string;
};

type ParsedLine = {
  productId: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  sortOrder: number;
};

type CalculatedInvoice = {
  discountTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  invoiceItems: Array<{
    description: string | null;
    discount: string;
    itemName: string;
    lineTotal: string;
    productId: string;
    quantity: string;
    sortOrder: number;
    taxAmount: string;
    taxRate: string;
    unit: string | null;
    unitPrice: string;
  }>;
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
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

function decimalValue(
  value: FormDataEntryValue | null,
  label: string,
): ParsedDecimal {
  const rawValue = typeof value === "string" ? value.trim().replace(/,/g, "") : "";

  if (!rawValue) {
    return { ok: true, value: new Prisma.Decimal(0) };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
    return {
      ok: false,
      error: `${label} must be a positive amount with up to 2 decimals.`,
    };
  }

  return { ok: true, value: new Prisma.Decimal(rawValue) };
}

function wholeNumberValue(
  value: FormDataEntryValue | null,
  label: string,
): ParsedDecimal {
  const rawValue = typeof value === "string" ? value.trim().replace(/,/g, "") : "";

  if (!rawValue) {
    return { ok: true, value: new Prisma.Decimal(0) };
  }

  if (!/^\d+(\.0{1,2})?$/.test(rawValue)) {
    return {
      ok: false,
      error: `${label} must be a whole number.`,
    };
  }

  return { ok: true, value: new Prisma.Decimal(rawValue) };
}

function dateValue(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function moneyString(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2).toFixed(2);
}

function invoicePath(invoiceId: string) {
  return `/dashboard/invoices/${invoiceId}`;
}

function emailListValue(value: string) {
  return value
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function parseLines(formData: FormData): ParsedLine[] | { error: string } {
  const productIds = formData.getAll("productId");
  const quantities = formData.getAll("quantity");
  const unitPrices = formData.getAll("unitPrice");
  const discounts = formData.getAll("discount");
  const taxRates = formData.getAll("taxRate");
  const lines: ParsedLine[] = [];

  for (const [index, productId] of productIds.entries()) {
    if (typeof productId !== "string" || !productId) {
      continue;
    }

    const quantity = wholeNumberValue(quantities[index], "Quantity");
    const unitPrice = decimalValue(unitPrices[index], "Unit price");
    const discount = decimalValue(discounts[index], "Discount");
    const taxRate = decimalValue(taxRates[index], "Tax rate");

    if (!quantity.ok) {
      return { error: quantity.error };
    }

    if (!unitPrice.ok) {
      return { error: unitPrice.error };
    }

    if (!discount.ok) {
      return { error: discount.error };
    }

    if (!taxRate.ok) {
      return { error: taxRate.error };
    }

    if (quantity.value.lte(0)) {
      return { error: "Quantity must be greater than 0." };
    }

    lines.push({
      productId,
      quantity: quantity.value,
      unitPrice: unitPrice.value,
      discount: discount.value,
      taxRate: taxRate.value,
      sortOrder: index,
    });
  }

  if (lines.length === 0) {
    return { error: "Add at least one invoice line item." };
  }

  return lines;
}

async function calculateInvoice(
  businessId: string,
  lines: ParsedLine[],
): Promise<CalculatedInvoice | { error: string }> {
  const products = await prisma.product.findMany({
    where: {
      businessId,
      id: {
        in: lines.map((line) => line.productId),
      },
      status: "active",
    },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  if (products.length !== new Set(lines.map((line) => line.productId)).size) {
    return { error: "One or more selected products/services were not found." };
  }

  let subtotal = new Prisma.Decimal(0);
  let discountTotal = new Prisma.Decimal(0);
  let taxTotal = new Prisma.Decimal(0);

  const invoiceItems = lines.map((line) => {
    const product = productsById.get(line.productId);

    if (!product) {
      throw new Error("Product lookup failed.");
    }

    const grossLineTotal = line.quantity.mul(line.unitPrice);
    const discount = line.discount.gt(grossLineTotal)
      ? grossLineTotal
      : line.discount;
    const taxableAmount = grossLineTotal.minus(discount);
    const taxAmount = taxableAmount.mul(line.taxRate).div(100);
    const lineTotal = taxableAmount.plus(taxAmount);

    subtotal = subtotal.plus(grossLineTotal);
    discountTotal = discountTotal.plus(discount);
    taxTotal = taxTotal.plus(taxAmount);

    return {
      productId: product.id,
      itemName: product.name,
      description: product.description,
      quantity: moneyString(line.quantity),
      unit: product.unit,
      unitPrice: moneyString(line.unitPrice),
      discount: moneyString(discount),
      taxRate: moneyString(line.taxRate),
      taxAmount: moneyString(taxAmount),
      lineTotal: moneyString(lineTotal),
      sortOrder: line.sortOrder,
    };
  });

  return {
    discountTotal,
    grandTotal: subtotal.minus(discountTotal).plus(taxTotal),
    invoiceItems,
    subtotal,
    taxTotal,
  };
}

async function validateInvoiceForm(
  formData: FormData,
) {
  const user = await requireUser();
  const customerId = formValue(formData, "customerId");
  const templateId = formValue(formData, "templateId") || null;

  if (!customerId) {
    return { error: "Select a customer for this invoice." };
  }

  const customer = await prisma.customer.findFirst({
    where: {
      businessId: user.businessId,
      id: customerId,
      status: "active",
    },
  });

  if (!customer) {
    return { error: "Selected customer was not found." };
  }

  const template = templateId
    ? await prisma.invoiceTemplate.findFirst({
        where: {
          businessId: user.businessId,
          id: templateId,
        },
      })
    : null;

  if (templateId && !template) {
    return { error: "Selected invoice template was not found." };
  }

  const lines = parseLines(formData);

  if ("error" in lines) {
    return { error: lines.error };
  }

  const calculatedInvoice = await calculateInvoice(user.businessId, lines);

  if ("error" in calculatedInvoice) {
    return { error: calculatedInvoice.error };
  }

  const invoiceDate =
    dateValue(formValue(formData, "invoiceDate")) ?? new Date();
  const dueDate = dateValue(formValue(formData, "dueDate"));

  return {
    calculatedInvoice,
    customerId,
    dueDate,
    invoiceDate,
    template,
    templateId,
    user,
  };
}

export async function createDraftInvoice(
  _state: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const validated = await validateInvoiceForm(formData);

  if ("error" in validated) {
    return { error: validated.error };
  }

  const {
    calculatedInvoice,
    customerId,
    dueDate,
    invoiceDate,
    template,
    templateId,
    user,
  } =
    validated;

  const invoiceId = await prisma.$transaction(async (tx) => {
    const business = await tx.business.findUniqueOrThrow({
      where: {
        id: user.businessId,
      },
    });
    const invoiceNumber = await nextInvoiceNumber(
      tx,
      user.businessId,
      business.invoicePrefix,
      business.invoiceStartingNumber,
    );

    const invoice = await tx.invoice.create({
      data: {
        businessId: user.businessId,
        customerId,
        createdById: user.id,
        invoiceNumber,
        status: "draft",
        invoiceDate,
        dueDate,
        subtotal: moneyString(calculatedInvoice.subtotal),
        discountTotal: moneyString(calculatedInvoice.discountTotal),
        taxTotal: moneyString(calculatedInvoice.taxTotal),
        grandTotal: moneyString(calculatedInvoice.grandTotal),
        paidAmount: "0",
        balanceAmount: moneyString(calculatedInvoice.grandTotal),
        notes:
          formValue(formData, "notes") ||
          (template
            ? parseInvoiceTemplateSettings(template.settings).defaultNotes
            : "") ||
          business.defaultNotes,
        templateId,
        terms:
          formValue(formData, "terms") ||
          (template
            ? parseInvoiceTemplateSettings(template.settings).defaultTerms
            : "") ||
          business.defaultTerms,
        items: {
          create: calculatedInvoice.invoiceItems,
        },
      },
    });

    return invoice.id;
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");

  redirect(invoicePath(invoiceId));
}

export async function updateDraftInvoice(
  _state: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const user = await requireUser();
  const invoiceId = formValue(formData, "invoiceId");

  if (!invoiceId) {
    return { error: "Invoice id is required." };
  }

  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      businessId: user.businessId,
      id: invoiceId,
      status: "draft",
    },
  });

  if (!existingInvoice) {
    return { error: "Only draft invoices can be edited." };
  }

  const validated = await validateInvoiceForm(formData);

  if ("error" in validated) {
    return { error: validated.error };
  }

  const { calculatedInvoice, customerId, dueDate, invoiceDate, templateId } =
    validated;

  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({
      where: {
        invoiceId,
      },
    });

    await tx.invoice.update({
      where: {
        id: invoiceId,
      },
      data: {
        customerId,
        invoiceDate,
        dueDate,
        subtotal: moneyString(calculatedInvoice.subtotal),
        discountTotal: moneyString(calculatedInvoice.discountTotal),
        taxTotal: moneyString(calculatedInvoice.taxTotal),
        grandTotal: moneyString(calculatedInvoice.grandTotal),
        balanceAmount: moneyString(
          calculatedInvoice.grandTotal.minus(existingInvoice.paidAmount),
        ),
        notes: formValue(formData, "notes") || null,
        templateId,
        terms: formValue(formData, "terms") || null,
        items: {
          create: calculatedInvoice.invoiceItems,
        },
      },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath(invoicePath(invoiceId));

  return { success: "Draft invoice updated." };
}

export async function finalizeDraftInvoice(formData: FormData) {
  return finalizeDraftInvoiceWithInventory({}, formData);
}

export async function finalizeDraftInvoiceWithInventory(
  _state: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const user = await requireUser();
  const invoiceId = formValue(formData, "invoiceId");

  if (!invoiceId) {
    return { error: "Invoice id is required." };
  }

  const adjustedProductIds: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      where: {
        businessId: user.businessId,
        id: invoiceId,
        status: "draft",
      },
    });

    if (!invoice) {
      return { error: "Only draft invoices can be finalized." };
    }

    const productQuantities = new Map<
      string,
      {
        product: NonNullable<(typeof invoice.items)[number]["product"]>;
        quantity: Prisma.Decimal;
      }
    >();

    for (const item of invoice.items) {
      if (!item.product || item.product.type !== "product") {
        continue;
      }

      const existing = productQuantities.get(item.product.id);

      if (existing) {
        existing.quantity = existing.quantity.plus(item.quantity);
      } else {
        productQuantities.set(item.product.id, {
          product: item.product,
          quantity: item.quantity,
        });
      }
    }

    for (const { product, quantity } of productQuantities.values()) {
      if (product.stockQuantity.lt(quantity)) {
        return {
          error: `Insufficient stock for ${product.name}. Available ${moneyString(
            product.stockQuantity,
          )}, required ${moneyString(quantity)}.`,
        };
      }
    }

    for (const { product, quantity } of productQuantities.values()) {
      const nextStock = product.stockQuantity.minus(quantity);

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
          invoiceId: invoice.id,
          notes: `Auto deduction for ${invoice.invoiceNumber}`,
          productId: product.id,
          quantity: moneyString(quantity.negated()),
          type: "invoice_deduction",
          unitCost: moneyString(product.costPrice),
        },
      });

      adjustedProductIds.push(product.id);
    }

    await tx.invoice.update({
      where: {
        id: invoiceId,
      },
      data: {
        finalizedAt: new Date(),
        status: "finalized",
      },
    });

    return { success: "Invoice finalized." };
  });

  if (result.error) {
    return result;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath(invoicePath(invoiceId));
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");

  for (const productId of adjustedProductIds) {
    revalidatePath(`/dashboard/products/${productId}`);
  }

  redirect(invoicePath(invoiceId));
}

export async function prepareInvoiceEmail(
  _state: InvoiceEmailActionState,
  formData: FormData,
): Promise<InvoiceEmailActionState> {
  const user = await requireUser();
  const invoiceId = formValue(formData, "invoiceId");
  const recipientEmail = normalizeEmail(formValue(formData, "recipientEmail"));
  const ccEmails = emailListValue(formValue(formData, "ccEmail"));
  const subject = formValue(formData, "subject");
  const body = formValue(formData, "body");

  if (!invoiceId) {
    return { error: "Invoice id is required." };
  }

  if (!recipientEmail || !validEmail(recipientEmail)) {
    return { error: "Enter a valid recipient email." };
  }

  if (ccEmails.some((email) => !validEmail(email))) {
    return { error: "CC emails must be valid and comma-separated." };
  }

  if (!subject || !body) {
    return { error: "Subject and email body are required." };
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      businessId: user.businessId,
      id: invoiceId,
    },
  });

  if (!invoice) {
    return { error: "Invoice was not found." };
  }

  await prisma.invoiceEmail.create({
    data: {
      body,
      businessId: user.businessId,
      ccEmail: ccEmails.length > 0 ? ccEmails.join(",") : null,
      createdById: user.id,
      invoiceId,
      recipientEmail,
      status: "prepared",
      subject,
    },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(invoicePath(invoiceId));
  revalidatePath(`${invoicePath(invoiceId)}/send`);

  return {
    success:
      "Invoice email draft prepared. Copy it into your email app and attach the invoice PDF if needed.",
  };
}
