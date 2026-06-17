"use server";

import { revalidatePath } from "next/cache";

import { formValue } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

export type InventoryActionState = {
  error?: string;
  success?: string;
};

const movementTypes = ["stock_in", "stock_out", "adjustment"];

function decimalValue(
  formData: FormData,
  key: string,
  label: string,
  { allowZero = false }: { allowZero?: boolean } = {},
) {
  const rawValue = formValue(formData, key).replace(/,/g, "");

  if (!rawValue) {
    return { error: `${label} is required.` };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
    return {
      error: `${label} must be a positive number with up to 2 decimals.`,
    };
  }

  const numberValue = Number(rawValue);

  if (!allowZero && numberValue <= 0) {
    return { error: `${label} must be greater than zero.` };
  }

  return {
    numberValue,
    value: numberValue.toFixed(2),
  };
}

function wholeNumberValue(
  formData: FormData,
  key: string,
  label: string,
  { allowZero = false }: { allowZero?: boolean } = {},
) {
  const rawValue = formValue(formData, key).replace(/,/g, "");

  if (!rawValue) {
    return { error: `${label} is required.` };
  }

  if (!/^\d+(\.0{1,2})?$/.test(rawValue)) {
    return {
      error: `${label} must be a whole number.`,
    };
  }

  const numberValue = Number(rawValue);

  if (!allowZero && numberValue <= 0) {
    return { error: `${label} must be greater than zero.` };
  }

  return {
    numberValue,
    value: numberValue.toFixed(2),
  };
}

function nullableValue(formData: FormData, key: string) {
  return formValue(formData, key) || null;
}

export async function recordInventoryMovement(
  _state: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const user = await requireUser();
  const productId = formValue(formData, "productId");
  const type = formValue(formData, "type");
  const quantity = wholeNumberValue(formData, "quantity", "Quantity", {
    allowZero: type === "adjustment",
  });
  const unitCost = decimalValue(formData, "unitCost", "Unit cost", {
    allowZero: true,
  });

  if (!productId) {
    return { error: "Choose a product to adjust." };
  }

  if (!movementTypes.includes(type)) {
    return { error: "Choose a valid movement type." };
  }

  if (quantity.error) {
    return { error: quantity.error };
  }

  if (unitCost.error) {
    return { error: unitCost.error };
  }

  const quantityNumber = quantity.numberValue ?? 0;
  const quantityValue = quantity.value ?? "0.00";
  const unitCostValue = unitCost.value ?? "0.00";

  const product = await prisma.product.findFirst({
    where: {
      businessId: user.businessId,
      id: productId,
      type: "product",
    },
  });

  if (!product) {
    return { error: "Product was not found or is not stock tracked." };
  }

  const currentStock = Number(product.stockQuantity);
  let nextStock = currentStock;
  let movementQuantity = quantityValue;

  if (type === "stock_in") {
    nextStock = currentStock + quantityNumber;
  }

  if (type === "stock_out") {
    if (currentStock < quantityNumber) {
      return {
        error: `Insufficient stock. ${product.name} has ${currentStock.toFixed(
          2,
        )} on hand.`,
      };
    }

    nextStock = currentStock - quantityNumber;
    movementQuantity = (-quantityNumber).toFixed(2);
  }

  if (type === "adjustment") {
    nextStock = quantityNumber;
    movementQuantity = (quantityNumber - currentStock).toFixed(2);
  }

  await prisma.$transaction([
    prisma.product.update({
      data: {
        stockQuantity: nextStock.toFixed(2),
      },
      where: {
        id: product.id,
      },
    }),
    prisma.inventoryMovement.create({
      data: {
        businessId: user.businessId,
        notes: nullableValue(formData, "notes"),
        productId: product.id,
        quantity: movementQuantity,
        type,
        unitCost: unitCostValue,
      },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${product.id}`);
  revalidatePath("/dashboard/inventory");

  return {
    success: `${product.name} stock updated to ${nextStock.toFixed(2)}.`,
  };
}
