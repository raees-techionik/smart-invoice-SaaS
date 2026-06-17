"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { formValue } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

export type RefundActionState = {
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

function wholeNumberValue(value: FormDataEntryValue | null, label: string) {
  const rawValue = typeof value === "string" ? value.trim().replace(/,/g, "") : "";

  if (!rawValue) {
    return { ok: true, value: new Prisma.Decimal(0) } satisfies ParsedDecimal;
  }

  if (!/^\d+(\.0{1,2})?$/.test(rawValue)) {
    return {
      ok: false,
      error: `${label} must be a whole number.`,
    } satisfies ParsedDecimal;
  }

  return { ok: true, value: new Prisma.Decimal(rawValue) } satisfies ParsedDecimal;
}

function moneyString(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2).toFixed(2);
}

function invoicePath(invoiceId: string) {
  return `/dashboard/invoices/${invoiceId}`;
}

async function nextRefundNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
) {
  const refundCount = await tx.refund.count({
    where: {
      businessId,
    },
  });
  let nextNumber = refundCount + 1;

  while (true) {
    const refundNumber = `RF-${String(nextNumber).padStart(5, "0")}`;
    const existingRefund = await tx.refund.findUnique({
      where: {
        businessId_refundNumber: {
          businessId,
          refundNumber,
        },
      },
    });

    if (!existingRefund) {
      return refundNumber;
    }

    nextNumber += 1;
  }
}

export async function createRefund(
  _state: RefundActionState,
  formData: FormData,
): Promise<RefundActionState> {
  const user = await requireUser();
  const invoiceId = formValue(formData, "invoiceId");

  if (!invoiceId) {
    return { error: "Invoice id is required." };
  }

  const invoiceItemIds = formData.getAll("invoiceItemId");
  const returnQuantities = formData.getAll("returnQuantity");
  const requestedReturns = new Map<string, Prisma.Decimal>();

  for (const [index, invoiceItemId] of invoiceItemIds.entries()) {
    if (typeof invoiceItemId !== "string" || !invoiceItemId) {
      continue;
    }

    const quantity = wholeNumberValue(returnQuantities[index], "Return quantity");

    if (!quantity.ok) {
      return { error: quantity.error };
    }

    if (quantity.value.lte(0)) {
      continue;
    }

    requestedReturns.set(
      invoiceItemId,
      (requestedReturns.get(invoiceItemId) ?? new Prisma.Decimal(0)).plus(
        quantity.value,
      ),
    );
  }

  if (requestedReturns.size === 0) {
    return { error: "Enter a return quantity for at least one invoice line." };
  }

  const adjustedProductIds: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      include: {
        customer: {
          select: {
            id: true,
          },
        },
        items: {
          include: {
            product: true,
            refundItems: {
              include: {
                refund: {
                  select: {
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
        refunds: {
          include: {
            items: true,
          },
          where: {
            status: "completed",
          },
        },
      },
      where: {
        businessId: user.businessId,
        id: invoiceId,
        status: "finalized",
      },
    });

    if (!invoice) {
      return { error: "Refunds can only be recorded for finalized invoices." };
    }

    const refundablePaidAmount = invoice.paidAmount.minus(
      invoice.refunds.reduce(
        (total, refund) => total.plus(refund.amount),
        new Prisma.Decimal(0),
      ),
    );
    const refundItems: Array<{
      invoiceItemId: string;
      itemName: string;
      productId: string | null;
      quantity: string;
      refundAmount: string;
      restockQuantity: string;
      unitPrice: string;
    }> = [];
    const restocksByProduct = new Map<
      string,
      {
        product: NonNullable<(typeof invoice.items)[number]["product"]>;
        quantity: Prisma.Decimal;
      }
    >();
    let refundTotal = new Prisma.Decimal(0);

    for (const item of invoice.items) {
      const requestedQuantity = requestedReturns.get(item.id);

      if (!requestedQuantity) {
        continue;
      }

      const alreadyRefundedQuantity = item.refundItems
        .filter((refundItem) => refundItem.refund.status === "completed")
        .reduce(
          (total, refundItem) => total.plus(refundItem.quantity),
          new Prisma.Decimal(0),
        );
      const remainingQuantity = item.quantity.minus(alreadyRefundedQuantity);

      if (requestedQuantity.gt(remainingQuantity)) {
        return {
          error: `${item.itemName} can only refund ${moneyString(
            remainingQuantity,
          )} more.`,
        };
      }

      if (item.quantity.lte(0)) {
        return { error: `${item.itemName} has no refundable quantity.` };
      }

      const perUnitRefund = item.lineTotal.div(item.quantity);
      const refundAmount = perUnitRefund.mul(requestedQuantity);
      const restockQuantity =
        item.product && item.product.type === "product"
          ? requestedQuantity
          : new Prisma.Decimal(0);

      refundTotal = refundTotal.plus(refundAmount);
      refundItems.push({
        invoiceItemId: item.id,
        itemName: item.itemName,
        productId: item.productId,
        quantity: moneyString(requestedQuantity),
        refundAmount: moneyString(refundAmount),
        restockQuantity: moneyString(restockQuantity),
        unitPrice: moneyString(item.unitPrice),
      });

      if (item.product && item.product.type === "product") {
        const existing = restocksByProduct.get(item.product.id);

        if (existing) {
          existing.quantity = existing.quantity.plus(restockQuantity);
        } else {
          restocksByProduct.set(item.product.id, {
            product: item.product,
            quantity: restockQuantity,
          });
        }
      }
    }

    const unknownItemIds = [...requestedReturns.keys()].filter(
      (itemId) => !invoice.items.some((item) => item.id === itemId),
    );

    if (unknownItemIds.length > 0) {
      return { error: "One or more refund lines were not found." };
    }

    if (refundItems.length === 0) {
      return { error: "Enter a valid return quantity before saving a refund." };
    }

    if (refundTotal.gt(refundablePaidAmount)) {
      return {
        error: `Refund amount ${moneyString(
          refundTotal,
        )} exceeds remaining paid amount ${moneyString(refundablePaidAmount)}.`,
      };
    }

    const refundNumber = await nextRefundNumber(tx, user.businessId);
    const refund = await tx.refund.create({
      data: {
        amount: moneyString(refundTotal),
        businessId: user.businessId,
        createdById: user.id,
        customerId: invoice.customer?.id ?? null,
        invoiceId: invoice.id,
        notes: formValue(formData, "notes") || null,
        reason: formValue(formData, "reason") || null,
        refundMethod: formValue(formData, "refundMethod") || "cash",
        refundNumber,
        status: "completed",
        items: {
          create: refundItems,
        },
      },
      select: {
        id: true,
        refundNumber: true,
      },
    });

    for (const { product, quantity } of restocksByProduct.values()) {
      if (quantity.lte(0)) {
        continue;
      }

      const nextStock = product.stockQuantity.plus(quantity);

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
          notes: `Stock restored from refund ${refund.refundNumber}`,
          productId: product.id,
          quantity: moneyString(quantity),
          type: "refund_return",
          unitCost: moneyString(product.costPrice),
        },
      });

      adjustedProductIds.push(product.id);
    }

    return {
      customerId: invoice.customer?.id ?? null,
      refundNumber: refund.refundNumber,
    };
  });

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath(invoicePath(invoiceId));
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");

  if (result.customerId) {
    revalidatePath(`/dashboard/customers/${result.customerId}`);
  }

  for (const productId of adjustedProductIds) {
    revalidatePath(`/dashboard/products/${productId}`);
  }

  return { success: `Refund ${result.refundNumber} recorded.` };
}
