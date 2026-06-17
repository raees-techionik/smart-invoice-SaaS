"use server";

import { revalidatePath } from "next/cache";

import { formValue } from "@/app/_backend/lib/auth/forms";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

export type ProductActionState = {
  error?: string;
  success?: string;
  warning?: string;
};

function nullableValue(formData: FormData, key: string) {
  return formValue(formData, key) || null;
}

function decimalValue(formData: FormData, key: string, label: string) {
  const rawValue = formValue(formData, key).replace(/,/g, "");

  if (!rawValue) {
    return { value: "0" };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
    return {
      error: `${label} must be a positive amount with up to 2 decimals.`,
    };
  }

  return { value: rawValue };
}

function wholeNumberValue(formData: FormData, key: string, label: string) {
  const rawValue = formValue(formData, key).replace(/,/g, "");

  if (!rawValue) {
    return { value: "0" };
  }

  if (!/^\d+(\.0{1,2})?$/.test(rawValue)) {
    return {
      error: `${label} must be a whole number.`,
    };
  }

  return { value: rawValue };
}

function productPath(productId: string) {
  return `/dashboard/products/${productId}`;
}

async function duplicateProductWarning({
  businessId,
  name,
  productId,
}: {
  businessId: string;
  name: string;
  productId?: string;
}) {
  const duplicate = await prisma.product.findFirst({
    select: {
      category: true,
      id: true,
      name: true,
      sku: true,
    },
    where: {
      businessId,
      id: productId
        ? {
            not: productId,
          }
        : undefined,
      name,
    },
  });

  if (!duplicate) {
    return undefined;
  }

  return `Possible duplicate item: ${duplicate.name}${
    duplicate.sku ? ` (${duplicate.sku})` : ""
  }${duplicate.category ? ` in ${duplicate.category}` : ""}.`;
}

export async function createProduct(
  _state: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const user = await requireUser();
  const name = formValue(formData, "name");
  const sku = nullableValue(formData, "sku");
  const type = formValue(formData, "type") || "product";

  if (!name) {
    return { error: "Product or service name is required." };
  }

  if (!["product", "service"].includes(type)) {
    return { error: "Type must be product or service." };
  }

  if (sku) {
    const existingSku = await prisma.product.findUnique({
      where: {
        businessId_sku: {
          businessId: user.businessId,
          sku,
        },
      },
    });

    if (existingSku) {
      return { error: "That SKU is already used by another item." };
    }
  }

  const salePrice = decimalValue(formData, "salePrice", "Sale price");
  const costPrice = decimalValue(formData, "costPrice", "Cost price");
  const taxRate = decimalValue(formData, "taxRate", "Tax rate");
  const stockQuantity = wholeNumberValue(
    formData,
    "stockQuantity",
    "Stock quantity",
  );
  const lowStockAlert = wholeNumberValue(
    formData,
    "lowStockAlert",
    "Low-stock alert",
  );

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

  const product = await prisma.product.create({
    data: {
      businessId: user.businessId,
      name,
      sku,
      category: nullableValue(formData, "category"),
      type,
      salePrice: salePrice.value,
      costPrice: costPrice.value,
      taxRate: taxRate.value,
      unit: nullableValue(formData, "unit"),
      stockQuantity: stockQuantity.value,
      lowStockAlert: lowStockAlert.value,
      description: nullableValue(formData, "description"),
      status: formValue(formData, "status") || "active",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");

  const warning = await duplicateProductWarning({
    businessId: user.businessId,
    name,
    productId: product.id,
  });

  return { success: "Product/service saved.", warning };
}

export async function updateProduct(
  _state: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const user = await requireUser();
  const productId = formValue(formData, "productId");
  const name = formValue(formData, "name");
  const sku = nullableValue(formData, "sku");
  const type = formValue(formData, "type") || "product";

  if (!productId) {
    return { error: "Product id is required." };
  }

  if (!name) {
    return { error: "Product or service name is required." };
  }

  if (!["product", "service"].includes(type)) {
    return { error: "Type must be product or service." };
  }

  const existingProduct = await prisma.product.findFirst({
    where: {
      businessId: user.businessId,
      id: productId,
    },
  });

  if (!existingProduct) {
    return { error: "Product/service was not found." };
  }

  if (sku) {
    const existingSku = await prisma.product.findUnique({
      where: {
        businessId_sku: {
          businessId: user.businessId,
          sku,
        },
      },
    });

    if (existingSku && existingSku.id !== productId) {
      return { error: "That SKU is already used by another item." };
    }
  }

  const salePrice = decimalValue(formData, "salePrice", "Sale price");
  const costPrice = decimalValue(formData, "costPrice", "Cost price");
  const taxRate = decimalValue(formData, "taxRate", "Tax rate");
  const stockQuantity = wholeNumberValue(
    formData,
    "stockQuantity",
    "Stock quantity",
  );
  const lowStockAlert = wholeNumberValue(
    formData,
    "lowStockAlert",
    "Low-stock alert",
  );

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

  await prisma.product.update({
    data: {
      category: nullableValue(formData, "category"),
      costPrice: costPrice.value,
      description: nullableValue(formData, "description"),
      lowStockAlert: lowStockAlert.value,
      name,
      salePrice: salePrice.value,
      sku,
      status: formValue(formData, "status") || "active",
      stockQuantity: stockQuantity.value,
      taxRate: taxRate.value,
      type,
      unit: nullableValue(formData, "unit"),
    },
    where: {
      id: productId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath(productPath(productId));

  const warning = await duplicateProductWarning({
    businessId: user.businessId,
    name,
    productId,
  });

  return { success: "Product/service updated.", warning };
}

export async function archiveProduct(formData: FormData) {
  const user = await requireUser();
  const productId = formValue(formData, "productId");

  if (!productId) {
    return;
  }

  const product = await prisma.product.findFirst({
    where: {
      businessId: user.businessId,
      id: productId,
    },
  });

  if (!product) {
    return;
  }

  await prisma.product.update({
    data: {
      status: "inactive",
    },
    where: {
      id: productId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath(productPath(productId));
}
