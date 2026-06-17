"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createDraftInvoice,
  type InvoiceActionState,
  updateDraftInvoice,
} from "@/app/dashboard/invoices/actions";

type CustomerOption = {
  id: string;
  name: string;
  businessName: string | null;
};

type ProductOption = {
  id: string;
  lowStockAlert: string;
  name: string;
  sku: string | null;
  type: string;
  unit: string | null;
  salePrice: string;
  stockQuantity: string;
  taxRate: string;
};

type TemplateOption = {
  id: string;
  isDefault: boolean;
  name: string;
  settings: {
    accentColor: string;
    defaultNotes: string;
    defaultTerms: string;
    footerText: string;
    layout: string;
    paymentInstructions: string;
    showLogo: boolean;
    showSignature: boolean;
    showStamp: boolean;
  };
};

type InvoiceFormProps = {
  customers: CustomerOption[];
  defaultNotes: string;
  defaultTerms: string;
  invoiceId?: string;
  initialCustomerId?: string;
  initialDueDate?: string;
  initialInvoiceDate?: string;
  initialLines?: DraftLineInput[];
  initialNotes?: string;
  initialTemplateId?: string;
  initialTerms?: string;
  products: ProductOption[];
  submitLabel?: string;
  templates: TemplateOption[];
};

type DraftLine = {
  id: number;
  productId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
};

type DraftLineInput = Omit<DraftLine, "id">;

const initialState: InvoiceActionState = {};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function numericValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quantityLabel(value: number | string) {
  const parsed = typeof value === "string" ? Number(value) : value;

  if (!Number.isFinite(parsed)) {
    return "0";
  }

  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}

function initialLine(products: ProductOption[]): DraftLine {
  return {
    id: Date.now(),
    productId: products[0]?.id ?? "",
    quantity: "1",
    unitPrice: products[0]?.salePrice ?? "0",
    discount: "0",
    taxRate: products[0]?.taxRate ?? "0",
  };
}

function lineFromInput(line: DraftLineInput, index: number): DraftLine {
  return {
    ...line,
    id: Date.now() + index,
  };
}

function FormMessage({ state }: { state: InvoiceActionState }) {
  if (state.error) {
    return (
      <p className="rounded-[7px] border border-[#e24b4a]/30 bg-[#fcebeb] px-3 py-2 text-[11.5px] text-[#a32d2d]">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-[7px] border border-[#639922]/30 bg-[#eaf3de] px-3 py-2 text-[11.5px] text-[#3b6d11]">
        {state.success}
      </p>
    );
  }

  return null;
}

function SaveDraftButton({
  disabled,
  label,
}: {
  disabled: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="mt-3 inline-flex h-[34px] w-full items-center justify-center rounded-lg bg-accent px-4 text-[12.5px] font-medium text-white transition hover:bg-[#2d7bc9] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Saving draft..." : label}
    </button>
  );
}

export function InvoiceForm({
  customers,
  defaultNotes,
  defaultTerms,
  invoiceId,
  initialCustomerId = "",
  initialDueDate = "",
  initialInvoiceDate,
  initialLines,
  initialNotes,
  initialTemplateId = "",
  initialTerms,
  products,
  submitLabel = "Save draft invoice",
  templates,
}: InvoiceFormProps) {
  const invoiceAction = invoiceId ? updateDraftInvoice : createDraftInvoice;
  const [state, action] = useActionState(invoiceAction, initialState);
  const hasInitialTemplate = templates.some(
    (template) => template.id === initialTemplateId,
  );
  const firstTemplateId =
    (hasInitialTemplate ? initialTemplateId : "") ||
    templates.find((template) => template.isDefault)?.id ||
    templates[0]?.id ||
    "";
  const [selectedTemplateId, setSelectedTemplateId] = useState(firstTemplateId);
  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );
  const [terms, setTerms] = useState(() =>
    initialTerms ??
    selectedTemplate?.settings.defaultTerms ??
    defaultTerms,
  );
  const [notes, setNotes] = useState(() =>
    initialNotes ??
    selectedTemplate?.settings.defaultNotes ??
    defaultNotes,
  );
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initialLines && initialLines.length > 0
      ? initialLines.map(lineFromInput)
      : [initialLine(products)],
  );
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const totals = lines.reduce(
    (currentTotals, line) => {
      const quantity = numericValue(line.quantity);
      const unitPrice = numericValue(line.unitPrice);
      const discount = numericValue(line.discount);
      const taxRate = numericValue(line.taxRate);
      const gross = quantity * unitPrice;
      const safeDiscount = Math.min(discount, gross);
      const taxable = gross - safeDiscount;
      const tax = (taxable * taxRate) / 100;

      return {
        discount: currentTotals.discount + safeDiscount,
        grand: currentTotals.grand + taxable + tax,
        subtotal: currentTotals.subtotal + gross,
        tax: currentTotals.tax + tax,
      };
    },
    {
      discount: 0,
      grand: 0,
      subtotal: 0,
      tax: 0,
    },
  );
  const stockUsage = lines.reduce<Record<string, number>>(
    (currentUsage, line) => {
      const product = productsById.get(line.productId);

      if (!product || product.type !== "product") {
        return currentUsage;
      }

      return {
        ...currentUsage,
        [line.productId]:
          (currentUsage[line.productId] ?? 0) + numericValue(line.quantity),
      };
    },
    {},
  );
  const stockWarnings = products
    .filter(
      (product) =>
        product.type === "product" &&
        (stockUsage[product.id] ?? 0) > numericValue(product.stockQuantity),
    )
    .map((product) => ({
      available: numericValue(product.stockQuantity),
      name: product.name,
      required: stockUsage[product.id] ?? 0,
      unit: product.unit || "units",
    }));

  function addLine() {
    setLines((currentLines) => [...currentLines, initialLine(products)]);
  }

  function removeLine(id: number) {
    setLines((currentLines) =>
      currentLines.length === 1
        ? currentLines
        : currentLines.filter((line) => line.id !== id),
    );
  }

  function updateLine(id: number, updates: Partial<DraftLine>) {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === id ? { ...line, ...updates } : line,
      ),
    );
  }

  function selectTemplate(templateId: string) {
    const nextTemplate = templates.find((template) => template.id === templateId);

    setSelectedTemplateId(templateId);
    setTerms(nextTemplate?.settings.defaultTerms ?? defaultTerms);
    setNotes(nextTemplate?.settings.defaultNotes ?? defaultNotes);
  }

  const canCreateInvoice = customers.length > 0 && products.length > 0;

  return (
    <form action={action} className="grid gap-3.5">
      {invoiceId ? (
        <input name="invoiceId" type="hidden" value={invoiceId} />
      ) : null}
      <FormMessage state={state} />
      {!canCreateInvoice ? (
        <p className="rounded-[7px] border border-border bg-[#f8f9fa] px-3 py-2 text-[11.5px] text-muted-foreground">
          Add at least one active customer and one active product/service before
          creating an invoice.
        </p>
      ) : null}
      {stockWarnings.length > 0 ? (
        <div className="rounded-[7px] border border-[#ba7517]/30 bg-[#faeeda] px-3 py-2 text-[11.5px] font-medium text-[#854f0b]">
          <p>
            Stock warning: this draft can be saved, but it cannot be finalized
            until shortages are fixed.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {stockWarnings.map((warning) => (
              <li key={warning.name}>
                {warning.name}: required {quantityLabel(warning.required)}, on
                hand {quantityLabel(warning.available)} {warning.unit}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-2.5 rounded-[10px] border border-border bg-[#f8f9fa] p-3 md:grid-cols-4">
        <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          Customer
          <select
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
            defaultValue={initialCustomerId}
            disabled={!canCreateInvoice}
            name="customerId"
            required
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.businessName ? `, ${customer.businessName}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          Template
          <select
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
            name="templateId"
            onChange={(event) => selectTemplate(event.target.value)}
            value={selectedTemplateId}
          >
            <option value="">No template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          Invoice date
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
            defaultValue={initialInvoiceDate ?? todayDate()}
            name="invoiceDate"
            type="date"
          />
        </label>
        <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          Due date
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
            defaultValue={initialDueDate}
            name="dueDate"
            type="date"
          />
        </label>
        <div className="rounded-[7px] border border-border bg-white p-3 md:col-span-4">
          <p className="text-[12px] font-medium">Status</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Saved invoices start as draft.
            {selectedTemplate
              ? ` Template: ${selectedTemplate.name}.`
              : " No reusable template selected."}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border bg-white">
        <div className="flex flex-col gap-2 border-b border-border bg-[#f8f9fa] p-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] text-[#94a3b8]">
              Line items
            </p>
            <h3 className="text-[13px] font-medium">Products and services</h3>
          </div>
          <button
            className="h-[31px] rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canCreateInvoice}
            onClick={addLine}
            type="button"
          >
            Add line
          </button>
        </div>
        <div className="grid gap-2 p-2">
          {lines.map((line, index) => {
            const product = productsById.get(line.productId);
            const quantity = numericValue(line.quantity);
            const unitPrice = numericValue(line.unitPrice);
            const discount = Math.min(
              numericValue(line.discount),
              quantity * unitPrice,
            );
            const taxRate = numericValue(line.taxRate);
            const taxable = quantity * unitPrice - discount;
            const tax = (taxable * taxRate) / 100;
            const lineTotal = taxable + tax;
            const stockAvailable = product
              ? numericValue(product.stockQuantity)
              : 0;
            const stockRequested = product
              ? stockUsage[product.id] ?? 0
              : 0;
            const isStockTracked = product?.type === "product";
            const exceedsStock = isStockTracked && stockRequested > stockAvailable;
            const isLowStock =
              isStockTracked &&
              numericValue(product.lowStockAlert) > 0 &&
              stockAvailable <= numericValue(product.lowStockAlert);

            return (
              <div
                className="grid gap-2 rounded-[9px] border border-border bg-white p-2"
                key={line.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] font-medium">Line {index + 1}</p>
                  <button
                    className="text-[11.5px] font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={lines.length === 1}
                    onClick={() => removeLine(line.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid items-start gap-2 xl:grid-cols-[minmax(240px,1.55fr)_90px_130px_130px_90px_104px]">
                  <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                    Item
                    <select
                      className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
                      disabled={!canCreateInvoice}
                      name="productId"
                      onChange={(event) => {
                        const nextProduct = productsById.get(
                          event.target.value,
                        );

                        updateLine(line.id, {
                          productId: event.target.value,
                          taxRate: nextProduct?.taxRate ?? "0",
                          unitPrice: nextProduct?.salePrice ?? "0",
                        });
                      }}
                      required
                      value={line.productId}
                    >
                      {products.map((productOption) => (
                        <option key={productOption.id} value={productOption.id}>
                          {productOption.name}
                          {productOption.sku ? ` (${productOption.sku})` : ""}
                          {productOption.type === "product"
                            ? ` - ${quantityLabel(
                                productOption.stockQuantity,
                              )} ${productOption.unit || "units"} available`
                            : " - service"}
                        </option>
                      ))}
                    </select>
                    {product ? (
                      <span
                        className={`w-fit rounded-[6px] px-2 py-1 text-[10.5px] font-medium ${
                          exceedsStock
                            ? "bg-[#fcebeb] text-[#a32d2d]"
                            : isLowStock
                              ? "bg-[#faeeda] text-[#854f0b]"
                              : "bg-[#e6f1fb] text-[#185fa5]"
                        }`}
                      >
                        {isStockTracked
                          ? `Stock ${quantityLabel(stockAvailable)} ${
                              product.unit || "units"
                            }; draft ${quantityLabel(stockRequested)}`
                          : "Service item; no stock deduction"}
                      </span>
                    ) : null}
                  </label>
                  <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                    Qty
                    <input
                      className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
                      min="1"
                      name="quantity"
                      onChange={(event) =>
                        updateLine(line.id, { quantity: event.target.value })
                      }
                      required
                      step="1"
                      type="number"
                      value={line.quantity}
                    />
                  </label>
                  <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                    Unit price
                    <input
                      className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
                      min="0"
                      name="unitPrice"
                      onChange={(event) =>
                        updateLine(line.id, { unitPrice: event.target.value })
                      }
                      step="0.01"
                      type="number"
                      value={line.unitPrice}
                    />
                  </label>
                  <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                    Discount
                    <input
                      className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
                      min="0"
                      name="discount"
                      onChange={(event) =>
                        updateLine(line.id, { discount: event.target.value })
                      }
                      step="0.01"
                      type="number"
                      value={line.discount}
                    />
                  </label>
                  <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                    Tax %
                    <input
                      className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
                      min="0"
                      name="taxRate"
                      onChange={(event) =>
                        updateLine(line.id, { taxRate: event.target.value })
                      }
                      step="0.01"
                      type="number"
                      value={line.taxRate}
                    />
                  </label>
                  <div className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                    Line total
                    <div className="grid h-[34px] items-center rounded-[7px] border border-border bg-[#f8f9fa] px-2.5">
                      <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-medium text-foreground">
                        {lineTotal.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-normal text-[#94a3b8]">
                        {product?.unit || product?.type || "item"}
                      </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
            Terms
            <textarea
              className="min-h-20 rounded-[7px] border border-border bg-white px-2.5 py-2 text-[12px] text-foreground outline-none transition focus:border-accent"
              name="terms"
              onChange={(event) => setTerms(event.target.value)}
              value={terms}
            />
          </label>
          <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
            Notes
            <textarea
              className="min-h-20 rounded-[7px] border border-border bg-white px-2.5 py-2 text-[12px] text-foreground outline-none transition focus:border-accent"
              name="notes"
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>
        </div>
        <div className="rounded-[10px] border border-border bg-[#f8f9fa] p-3">
          <p className="text-[11px] text-[#94a3b8]">
            Draft totals
          </p>
          <dl className="mt-3 grid gap-2 text-xs">
            <div className="flex justify-between gap-4">
              <dt>Subtotal</dt>
              <dd className="font-semibold">{totals.subtotal.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Discount</dt>
              <dd className="font-semibold">{totals.discount.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt>Tax</dt>
              <dd className="font-semibold">{totals.tax.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-[14px]">
              <dt className="font-semibold">Grand total</dt>
              <dd className="font-semibold">{totals.grand.toFixed(2)}</dd>
            </div>
          </dl>
          <SaveDraftButton disabled={!canCreateInvoice} label={submitLabel} />
        </div>
      </div>
    </form>
  );
}
