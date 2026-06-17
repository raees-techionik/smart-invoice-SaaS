"use server";

import { Prisma, type Product } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { formValue } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

export type PosActionState = {
  error?: string;
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

type ParsedLine = {
  discount: Prisma.Decimal;
  productId: string;
  quantity: Prisma.Decimal;
  sortOrder: number;
  taxRate: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
};

type PosProduct = Product;

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

function moneyString(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2).toFixed(2);
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
      discount: discount.value,
      productId,
      quantity: quantity.value,
      sortOrder: index,
      taxRate: taxRate.value,
      unitPrice: unitPrice.value,
    });
  }

  if (lines.length === 0) {
    return { error: "Add at least one item before finalizing a POS bill." };
  }

  return lines;
}

function calculateInvoice(
  products: PosProduct[],
  lines: ParsedLine[],
): CalculatedInvoice | { error: string } {
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
      description: product.description,
      discount: moneyString(discount),
      itemName: product.name,
      lineTotal: moneyString(lineTotal),
      productId: product.id,
      quantity: moneyString(line.quantity),
      sortOrder: line.sortOrder,
      taxAmount: moneyString(taxAmount),
      taxRate: moneyString(line.taxRate),
      unit: product.unit,
      unitPrice: moneyString(line.unitPrice),
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

async function walkInCustomerId(
  tx: Prisma.TransactionClient,
  businessId: string,
) {
  const existingCustomer = await tx.customer.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
    where: {
      businessId,
      name: "Walk-in Customer",
      status: "active",
    },
  });

  if (existingCustomer) {
    return existingCustomer.id;
  }

  const customer = await tx.customer.create({
    data: {
      businessId,
      name: "Walk-in Customer",
      notes: "Default customer profile for POS-lite cash billing.",
    },
    select: {
      id: true,
    },
  });

  return customer.id;
}

async function posCustomerId(
  tx: Prisma.TransactionClient,
  businessId: string,
  customerName: string,
  customerPhone: string,
) {
  const name = customerName || "Walk-in Customer";
  const phone = customerPhone || null;

  if (!customerName && !phone) {
    return walkInCustomerId(tx, businessId);
  }

  const existingCustomer = await tx.customer.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
    where: {
      businessId,
      status: "active",
      ...(phone
        ? {
            phone,
          }
        : {
            name,
          }),
    },
  });

  if (existingCustomer) {
    return existingCustomer.id;
  }

  const customer = await tx.customer.create({
    data: {
      businessId,
      name,
      notes: "Created from POS-lite walk-in billing.",
      phone,
    },
    select: {
      id: true,
    },
  });

  return customer.id;
}

function invoicePath(invoiceId: string) {
  return `/dashboard/invoices/${invoiceId}`;
}

export async function createPosInvoice(
  _state: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  const user = await requireUser();
  const lines = parseLines(formData);
  const cashReceived = decimalValue(
    formData.get("cashReceived"),
    "Cash received",
  );
  const customerName = formValue(formData, "customerName");
  const customerPhone = formValue(formData, "customerPhone");

  if ("error" in lines) {
    return { error: lines.error };
  }

  if (!cashReceived.ok) {
    return { error: cashReceived.error };
  }

  const adjustedProductIds: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const business = await tx.business.findUniqueOrThrow({
      where: {
        id: user.businessId,
      },
    });
    const products = await tx.product.findMany({
      where: {
        businessId: user.businessId,
        id: {
          in: lines.map((line) => line.productId),
        },
        status: "active",
      },
    });
    const calculatedInvoice = calculateInvoice(products, lines);

    if ("error" in calculatedInvoice) {
      return { error: calculatedInvoice.error };
    }

    if (calculatedInvoice.grandTotal.lte(0)) {
      return { error: "POS bill total must be greater than zero." };
    }

    if (cashReceived.value.lt(calculatedInvoice.grandTotal)) {
      return {
        error: `Cash received is short by ${moneyString(
          calculatedInvoice.grandTotal.minus(cashReceived.value),
        )}.`,
      };
    }

    const productQuantities = new Map<
      string,
      {
        product: PosProduct;
        quantity: Prisma.Decimal;
      }
    >();

    for (const line of lines) {
      const product = products.find((item) => item.id === line.productId);

      if (!product || product.type !== "product") {
        continue;
      }

      const existing = productQuantities.get(product.id);

      if (existing) {
        existing.quantity = existing.quantity.plus(line.quantity);
      } else {
        productQuantities.set(product.id, {
          product,
          quantity: line.quantity,
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

    const customerId = await posCustomerId(
      tx,
      user.businessId,
      customerName,
      customerPhone,
    );
    const invoiceNumber = await nextInvoiceNumber(
      tx,
      user.businessId,
      business.invoicePrefix,
      business.invoiceStartingNumber,
    );
    const changeDue = cashReceived.value.minus(calculatedInvoice.grandTotal);
    const invoice = await tx.invoice.create({
      data: {
        balanceAmount: "0.00",
        businessId: user.businessId,
        createdById: user.id,
        customerId,
        discountTotal: moneyString(calculatedInvoice.discountTotal),
        dueDate: new Date(),
        finalizedAt: new Date(),
        grandTotal: moneyString(calculatedInvoice.grandTotal),
        invoiceDate: new Date(),
        invoiceNumber,
        invoiceType: "pos",
        items: {
          create: calculatedInvoice.invoiceItems,
        },
        notes:
          formValue(formData, "notes") ||
          "POS-lite walk-in bill generated from quick checkout.",
        paidAmount: moneyString(calculatedInvoice.grandTotal),
        status: "finalized",
        subtotal: moneyString(calculatedInvoice.subtotal),
        taxTotal: moneyString(calculatedInvoice.taxTotal),
        terms: "Paid at counter.",
      },
      select: {
        id: true,
      },
    });

    await tx.payment.create({
      data: {
        amount: moneyString(calculatedInvoice.grandTotal),
        businessId: user.businessId,
        createdById: user.id,
        invoiceId: invoice.id,
        notes: `POS cash checkout. Received ${moneyString(
          cashReceived.value,
        )}; change ${moneyString(changeDue)}.`,
        paymentDate: new Date(),
        paymentMethod: "cash",
      },
    });

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
          notes: `POS deduction for ${invoiceNumber}`,
          productId: product.id,
          quantity: moneyString(quantity.negated()),
          type: "invoice_deduction",
          unitCost: moneyString(product.costPrice),
        },
      });

      adjustedProductIds.push(product.id);
    }

    return { invoiceId: invoice.id };
  });

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/products");
  revalidatePath(invoicePath(result.invoiceId));

  for (const productId of adjustedProductIds) {
    revalidatePath(`/dashboard/products/${productId}`);
  }

  redirect(`${invoicePath(result.invoiceId)}?print=1`);
}
