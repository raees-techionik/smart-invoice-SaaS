"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createProduct,
  type ProductActionState,
  updateProduct,
} from "@/app/dashboard/products/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";

const initialState: ProductActionState = {};

type ProductFormDefaults = {
  category: string;
  costPrice: string;
  description: string;
  lowStockAlert: string;
  name: string;
  salePrice: string;
  sku: string;
  status: string;
  stockQuantity: string;
  taxRate: string;
  type: string;
  unit: string;
};

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  required = false,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
      {label}
      <input
        className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
        defaultValue={defaultValue}
        min={type === "number" ? "0" : undefined}
        name={name}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
      {label}
      <textarea
        className="min-h-16 rounded-[8px] border border-white/70 bg-white/85 px-2.5 py-2 text-[12px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function FormMessage({ state }: { state: ProductActionState }) {
  if (state.error) {
    return (
      <p className="rounded-[7px] border border-[#e24b4a]/30 bg-[#fcebeb] px-3 py-2 text-[11.5px] font-medium text-[#a32d2d]">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <div className="grid gap-2">
        <p className="rounded-[7px] border border-[#639922]/30 bg-[#eaf3de] px-3 py-2 text-[11.5px] font-medium text-[#3b6d11]">
          {state.success}
        </p>
        {state.warning ? (
          <p className="rounded-[7px] border border-[#ba7517]/30 bg-[#faeeda] px-3 py-2 text-[11.5px] font-medium text-[#854f0b]">
            {state.warning}
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}

export function ProductForm({
  defaults,
  productId,
  submitLabel = "Save item",
}: {
  defaults?: ProductFormDefaults;
  productId?: string;
  submitLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const actionHandler = productId ? updateProduct : createProduct;
  const [state, action] = useActionState(actionHandler, initialState);

  useEffect(() => {
    if (state.success && !productId) {
      formRef.current?.reset();
    }
  }, [productId, state.success]);

  return (
    <form action={action} className="grid gap-3" ref={formRef}>
      {productId ? (
        <input name="productId" type="hidden" value={productId} />
      ) : null}
      <FormMessage state={state} />
      <div className="grid gap-2 md:grid-cols-2">
        <Field
          defaultValue={defaults?.name}
          label="Product/service name"
          name="name"
          placeholder="Consulting hour, T-shirt, repair service"
          required
        />
        <Field
          defaultValue={defaults?.sku}
          label="SKU"
          name="sku"
          placeholder="Optional unique code"
        />
        <Field
          defaultValue={defaults?.category}
          label="Category"
          name="category"
          placeholder="Retail, labor..."
        />
        <Field
          defaultValue={defaults?.unit}
          label="Unit"
          name="unit"
          placeholder="pcs, kg, hour..."
        />
        <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          Type
          <select
            className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
            defaultValue={defaults?.type ?? "product"}
            name="type"
          >
            <option value="product">Product</option>
            <option value="service">Service</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          Status
          <select
            className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
            defaultValue={defaults?.status ?? "active"}
            name="status"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <Field
          defaultValue={defaults?.salePrice}
          label="Sale price"
          name="salePrice"
          placeholder="0.00"
          step="0.01"
          type="number"
        />
        <Field
          defaultValue={defaults?.costPrice}
          label="Cost price"
          name="costPrice"
          placeholder="0.00"
          step="0.01"
          type="number"
        />
        <Field
          defaultValue={defaults?.taxRate}
          label="Tax rate %"
          name="taxRate"
          placeholder="0.00"
          step="0.01"
          type="number"
        />
        <Field
          defaultValue={defaults?.stockQuantity}
          label="Stock quantity"
          name="stockQuantity"
          placeholder="0"
          step="1"
          type="number"
        />
        <Field
          defaultValue={defaults?.lowStockAlert}
          label="Low-stock alert"
          name="lowStockAlert"
          placeholder="0"
          step="1"
          type="number"
        />
      </div>
      <TextArea
        defaultValue={defaults?.description}
        label="Description"
        name="description"
        placeholder="Internal notes, item details, or invoice-facing description."
      />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving item...">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
