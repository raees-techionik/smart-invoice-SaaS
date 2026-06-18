"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  recordInventoryMovement,
  type InventoryActionState,
} from "@/app/dashboard/inventory/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";

const initialState: InventoryActionState = {};

type InventoryProductOption = {
  costPrice: string;
  id: string;
  name: string;
  sku: string;
  stockQuantity: string;
  unit: string;
};

function FormMessage({ state }: { state: InventoryActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
        {state.success}
      </p>
    );
  }

  return null;
}

export function InventoryAdjustmentForm({
  products,
  selectedProductId,
}: {
  products: InventoryProductOption[];
  selectedProductId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(recordInventoryMovement, initialState);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form action={action} className="grid gap-5" ref={formRef}>
      <FormMessage state={state} />

      <label className="grid gap-2 text-sm font-medium text-foreground">
        Product
        <select
          className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition focus:border-accent"
          defaultValue={selectedProductId ?? products[0]?.id ?? ""}
          name="productId"
          required
        >
          <option disabled value="">
            Choose product
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
              {product.sku ? ` (${product.sku})` : ""} - {product.stockQuantity}{" "}
              {product.unit || "units"}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Movement type
          <select
            className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition focus:border-accent"
            name="type"
          >
            <option value="stock_in">Stock in</option>
            <option value="stock_out">Stock out</option>
            <option value="adjustment">Physical count adjustment</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-foreground">
          Quantity / target
          <input
            className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
            min="0"
            name="quantity"
            placeholder="0"
            required
            step="1"
            type="number"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-foreground">
          Unit cost
          <input
            className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
            min="0"
            name="unitCost"
            placeholder="0.00"
            required
            step="0.01"
            type="number"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-foreground">
        Notes
        <textarea
          className="min-h-20 rounded-[8px] border border-white/70 bg-white/85 px-2.5 py-2 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
          name="notes"
          placeholder="Supplier receipt, damaged stock, physical count, or reason for adjustment."
        />
      </label>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Updating stock...">
          Record movement
        </SubmitButton>
      </div>
    </form>
  );
}
