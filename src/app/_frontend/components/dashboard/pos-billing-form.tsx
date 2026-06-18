"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createPosInvoice,
  type PosActionState,
} from "@/app/dashboard/pos/actions";

type ProductOption = {
  category: string | null;
  id: string;
  lowStockAlert: string;
  name: string;
  salePrice: string;
  sku: string | null;
  stockQuantity: string;
  taxRate: string;
  type: string;
  unit: string | null;
};

type CartLine = {
  discount: string;
  product: ProductOption;
  quantity: string;
};

type PosBillingFormProps = {
  currency: string;
  products: ProductOption[];
};

const initialState: PosActionState = {};

function numericValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decimalText(value: number | string) {
  const parsed = typeof value === "string" ? Number(value) : value;

  if (!Number.isFinite(parsed)) {
    return "0";
  }

  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}

function currencyFormatter(currency: string) {
  return new Intl.NumberFormat("en-PK", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  });
}

function CheckoutButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="premium-button inline-flex h-[38px] w-full items-center justify-center rounded-lg px-4 text-[12px] font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Finalizing bill..." : "Finalize and print bill"}
    </button>
  );
}

export function PosBillingForm({ currency, products }: PosBillingFormProps) {
  const [state, action] = useActionState(createPosInvoice, initialState);
  const [query, setQuery] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const money = useMemo(() => currencyFormatter(currency), [currency]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!normalizedQuery) {
      return products.slice(0, 18);
    }

    return products
      .filter((product) => {
        const haystack = [
          product.name,
          product.sku ?? "",
          product.category ?? "",
          product.type,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .slice(0, 24);
  }, [normalizedQuery, products]);
  const totals = cart.reduce(
    (currentTotals, line) => {
      const quantity = numericValue(line.quantity);
      const unitPrice = numericValue(line.product.salePrice);
      const discount = numericValue(line.discount);
      const taxRate = numericValue(line.product.taxRate);
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
  const stockWarnings = cart
    .filter(
      (line) =>
        line.product.type === "product" &&
        numericValue(line.quantity) > numericValue(line.product.stockQuantity),
    )
    .map((line) => ({
      available: numericValue(line.product.stockQuantity),
      name: line.product.name,
      required: numericValue(line.quantity),
      unit: line.product.unit || "units",
    }));
  const invalidLine = cart.some((line) => numericValue(line.quantity) <= 0);
  const cashValue = numericValue(cashReceived);
  const shortTender = totals.grand > 0 && cashValue < totals.grand;
  const changeDue = Math.max(cashValue - totals.grand, 0);
  const checkoutDisabled =
    cart.length === 0 ||
    invalidLine ||
    stockWarnings.length > 0 ||
    totals.grand <= 0 ||
    shortTender;

  function addProduct(product: ProductOption) {
    const isOutOfStock =
      product.type === "product" && numericValue(product.stockQuantity) <= 0;

    if (isOutOfStock) {
      return;
    }

    setCart((currentCart) => {
      const existingLine = currentCart.find(
        (line) => line.product.id === product.id,
      );

      if (existingLine) {
        return currentCart.map((line) =>
          line.product.id === product.id
            ? {
                ...line,
                quantity: String(numericValue(line.quantity) + 1),
              }
            : line,
        );
      }

      return [
        ...currentCart,
        {
          discount: "0",
          product,
          quantity: "1",
        },
      ];
    });
  }

  function updateQuantity(productId: string, quantity: string) {
    setCart((currentCart) =>
      currentCart.map((line) =>
        line.product.id === productId ? { ...line, quantity } : line,
      ),
    );
  }

  function updateDiscount(productId: string, discount: string) {
    setCart((currentCart) =>
      currentCart.map((line) =>
        line.product.id === productId ? { ...line, discount } : line,
      ),
    );
  }

  function removeLine(productId: string) {
    setCart((currentCart) =>
      currentCart.filter((line) => line.product.id !== productId),
    );
  }

  return (
    <form
      action={action}
      className="relative z-[1] grid gap-3.5 xl:grid-cols-[1fr_420px]"
    >
      <section className="premium-card rounded-[16px] border p-4">
        <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Quick product search
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              Add items to counter bill
            </h3>
          </div>
          <input
            className="h-[34px] w-full rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent md:max-w-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by item, SKU, category"
            value={query}
          />
        </div>

        {products.length === 0 ? (
          <div className="grid min-h-80 place-items-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">No active products yet</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Add products or services before using POS-lite billing.
              </p>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="grid min-h-80 place-items-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">No matching items</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Try another product name, SKU, or category.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const stockQuantity = numericValue(product.stockQuantity);
              const isStockItem = product.type === "product";
              const isOutOfStock = isStockItem && stockQuantity <= 0;
              const isLowStock =
                isStockItem &&
                numericValue(product.lowStockAlert) > 0 &&
                stockQuantity <= numericValue(product.lowStockAlert);

              return (
                <button
                  className="grid min-h-36 gap-3 rounded-[10px] border border-white/70 bg-white/65 p-3 text-left shadow-[0_14px_40px_rgba(15,23,42,0.06)] transition hover:border-[#635bff]/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isOutOfStock}
                  key={product.id}
                  onClick={() => addProduct(product)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold leading-5">{product.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        {product.sku || product.category || product.type}
                      </p>
                    </div>
                    <span className="rounded-[5px] bg-[#eef2ff] px-2 py-0.5 text-[9.5px] font-medium capitalize text-[#4f46e5]">
                      {product.type}
                    </span>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">
                        {money.format(numericValue(product.salePrice))}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tax {decimalText(product.taxRate)}%
                      </p>
                    </div>
                    <p
                      className={`text-right text-xs font-semibold ${
                        isOutOfStock
                          ? "text-danger"
                          : isLowStock
                            ? "text-warning"
                            : "text-muted-foreground"
                      }`}
                    >
                      {isStockItem
                        ? `${decimalText(product.stockQuantity)} ${
                            product.unit || "units"
                          }`
                        : "No stock tracking"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className="grid gap-4 self-start xl:sticky xl:top-20">
        <section className="premium-card rounded-[16px] border p-4">
          <div className="flex items-center justify-between gap-4 border-b border-border p-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Checkout
              </p>
              <h3 className="mt-1 text-[13px] font-medium">Walk-in customer</h3>
            </div>
            <span className="rounded-[5px] bg-[#eef2ff] px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-[#4f46e5]">
              POS
            </span>
          </div>

          <div className="grid gap-4 p-5">
            <div className="grid gap-3 rounded-[10px] border border-white/70 bg-white/60 p-3">
              <div>
                <p className="text-sm font-semibold">Customer details</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Optional for walk-in bills. Leave blank for anonymous counter
                  sales.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                  Name
                  <input
                    className="h-10 rounded-[8px] border border-white/70 bg-white/85 px-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/15"
                    name="customerName"
                    placeholder="Walk-in customer"
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                  Phone
                  <input
                    className="h-10 rounded-[8px] border border-white/70 bg-white/85 px-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/15"
                    name="customerPhone"
                    placeholder="Optional phone"
                  />
                </label>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/70 bg-white/55 p-6 text-center">
                <p className="font-semibold">Cart is empty</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Search or tap products to start a fast counter bill.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {cart.map((line) => {
                  const lineGross =
                    numericValue(line.quantity) *
                    numericValue(line.product.salePrice);
                  const lineDiscount = Math.min(
                    numericValue(line.discount),
                    lineGross,
                  );
                  const lineTax =
                    ((lineGross - lineDiscount) *
                      numericValue(line.product.taxRate)) /
                    100;
                  const lineTotal = lineGross - lineDiscount + lineTax;

                  return (
                    <div
                      className="rounded-[10px] border border-white/70 bg-white/65 p-3"
                      key={line.product.id}
                    >
                      <input
                        name="productId"
                        type="hidden"
                        value={line.product.id}
                      />
                      <input
                        name="unitPrice"
                        type="hidden"
                        value={line.product.salePrice}
                      />
                      <input
                        name="taxRate"
                        type="hidden"
                        value={line.product.taxRate}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{line.product.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {line.product.type === "product"
                              ? `Stock ${decimalText(
                                  line.product.stockQuantity,
                                )} ${line.product.unit || "units"}`
                              : "Service item"}
                          </p>
                        </div>
                        <button
                          className="premium-soft-button rounded-[6px] border px-2 py-1 text-[10.5px] font-medium transition hover:border-[#635bff]/30 hover:bg-white"
                          onClick={() => removeLine(line.product.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                          Qty
                          <input
                            className="h-10 rounded-[8px] border border-white/70 bg-white/85 px-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                            min="1"
                            name="quantity"
                            onChange={(event) =>
                              updateQuantity(line.product.id, event.target.value)
                            }
                            step="1"
                            type="number"
                            value={line.quantity}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                          Discount
                          <input
                            className="h-10 rounded-[8px] border border-white/70 bg-white/85 px-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                            min="0"
                            name="discount"
                            onChange={(event) =>
                              updateDiscount(line.product.id, event.target.value)
                            }
                            step="0.01"
                            type="number"
                            value={line.discount}
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {money.format(numericValue(line.product.salePrice))} x{" "}
                          {decimalText(line.quantity)}
                        </span>
                        <span className="font-semibold">
                          {money.format(lineTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {stockWarnings.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-semibold">Stock shortage</p>
                <ul className="mt-1 list-disc pl-4">
                  {stockWarnings.map((warning) => (
                    <li key={warning.name}>
                      {warning.name}: required {decimalText(warning.required)},{" "}
                      available {decimalText(warning.available)} {warning.unit}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {state.error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {state.error}
              </p>
            ) : null}
          </div>
        </section>

        <section className="premium-card rounded-[16px] border p-4">
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">
                {money.format(totals.subtotal)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-semibold">
                {money.format(totals.discount)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-semibold">{money.format(totals.tax)}</span>
            </div>
            <div className="flex justify-between gap-4 text-lg">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">{money.format(totals.grand)}</span>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-1 text-sm font-semibold">
              Cash received
              <input
                className="h-[38px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[14px] font-medium outline-none transition focus:border-accent"
                min="0"
                name="cashReceived"
                onChange={(event) => setCashReceived(event.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={cashReceived}
              />
            </label>
            <button
              className="premium-soft-button h-[34px] rounded-lg border px-3 text-[11.5px] font-medium transition hover:border-[#635bff]/30 hover:bg-white"
              onClick={() => setCashReceived(totals.grand.toFixed(2))}
              type="button"
            >
              Exact cash
            </button>
            <div className="rounded-lg border border-white/70 bg-white/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Change due</span>
                <span className="text-2xl font-semibold">
                  {money.format(changeDue)}
                </span>
              </div>
              {shortTender ? (
                <p className="mt-2 text-sm font-medium text-danger">
                  Cash is short by {money.format(totals.grand - cashValue)}.
                </p>
              ) : null}
            </div>
          </div>

          <label className="mt-5 grid gap-1 text-sm font-semibold">
            Notes
            <textarea
              className="min-h-20 rounded-lg border border-white/70 bg-white/65 px-3 py-2 text-sm font-normal outline-none transition placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/15"
              name="notes"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional bill note"
              value={notes}
            />
          </label>

          <div className="mt-5 grid gap-2">
            <CheckoutButton disabled={checkoutDisabled} />
            <button
              className="premium-soft-button inline-flex h-[34px] w-full items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition hover:border-[#635bff]/30 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={cart.length === 0}
              onClick={() => {
                setCart([]);
                setCashReceived("");
              }}
              type="button"
            >
              Clear cart
            </button>
          </div>
        </section>
      </aside>
    </form>
  );
}
