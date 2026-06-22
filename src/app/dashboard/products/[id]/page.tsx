import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { archiveProduct } from "@/app/dashboard/products/actions";
import { ProductForm } from "@/app/_frontend/components/dashboard/product-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { AppIcon, metricIconForLabel } from "@/app/_frontend/components/dashboard/app-icons";


type ProductDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function currencyFormatter(currency: string) {
  return new Intl.NumberFormat("en-PK", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  });
}

function dateFormatter(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function decimalInputValue(value: unknown) {
  return Number(value).toFixed(2);
}

function decimalText(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(2);
}

function MetricCard({
  helper,
  label,
  tone,
  value,
}: {
  helper: string;
  label: string;
  tone: "blue" | "green" | "amber";
  value: string;
}) {
  const toneClasses = {
    amber: "bg-[#faeeda] text-[#854f0b]",
    blue: "bg-[#e6f1fb] text-[#185fa5]",
    green: "bg-[#eaf3de] text-[#3b6d11]",
  };

  return (
    <div className="rounded-[14px] border border-border bg-white p-[15px]">
      <div
        className={`mb-2.5 grid size-8 place-items-center rounded-lg text-[11px] font-semibold ${toneClasses[tone]}`}
      >
        <AppIcon className="size-4" name={metricIconForLabel(label)} />
      </div>
      <p className="font-mono text-[20px] font-medium leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[10.5px] text-[#94a3b8]">{helper}</p>
    </div>
  );
}

function MovementBadge({ type }: { type: string }) {
  const positive =
    type === "stock_in" || type === "adjustment" || type === "refund_return";

  return (
    <span
      className={`inline-flex rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium capitalize ${
        positive ? "bg-[#eaf3de] text-[#3b6d11]" : "bg-[#fcebeb] text-[#a32d2d]"
      }`}
    >
      {type.replace(/_/g, " ")}
    </span>
  );
}

function Card({
  children,
  className = "",
  subtitle,
  title,
}: {
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className={`rounded-[14px] border border-border bg-white p-4 ${className}`}>
      <div className="mb-[13px] flex items-center justify-between gap-4">
        <h3 className="text-[13px] font-medium">{title}</h3>
        {subtitle ? (
          <span className="text-[11px] text-[#94a3b8]">{subtitle}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="grid min-h-36 place-items-center text-center">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const money = currencyFormatter(user.business.currency);

  const product = await prisma.product.findFirst({
    include: {
      inventoryMovements: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      },
      invoiceItems: {
        include: {
          invoice: {
            include: {
              customer: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          invoice: {
            invoiceDate: "desc",
          },
        },
        take: 25,
      },
    },
    where: {
      businessId: user.businessId,
      id,
    },
  });

  if (!product) {
    notFound();
  }

  const totalSold = product.invoiceItems.reduce(
    (currentTotal, item) => currentTotal + Number(item.quantity),
    0,
  );
  const salesValue = product.invoiceItems.reduce(
    (currentTotal, item) => currentTotal + Number(item.lineTotal),
    0,
  );
  const stockValue = Number(product.stockQuantity) * Number(product.costPrice);
  const isLowStock =
    product.type === "product" &&
    Number(product.lowStockAlert) > 0 &&
    Number(product.stockQuantity) <= Number(product.lowStockAlert);

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Product
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            {product.name}
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            {product.type} - {product.sku || product.category || "No SKU"} -{" "}
            {money.format(Number(product.salePrice))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/products"
          >
            Back
          </Link>
          {product.type === "product" ? (
            <Link
              className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
              href={`/dashboard/inventory?productId=${product.id}`}
            >
              Adjust stock
            </Link>
          ) : null}
          {product.status !== "inactive" ? (
            <form action={archiveProduct}>
              <input name="productId" type="hidden" value={product.id} />
              <button
                className="inline-flex h-[34px] items-center justify-center rounded-lg border border-[#e24b4a]/30 bg-white px-3 text-[11.5px] font-medium text-[#a32d2d] transition hover:bg-[#fcebeb]"
                type="submit"
              >
                Archive item
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <section className="grid gap-[11px] md:grid-cols-4">
        <MetricCard
          helper="Catalog lifecycle"
          label="Status"
          tone={product.status === "active" ? "green" : "amber"}
          value={product.status}
        />
        <MetricCard
          helper="Default invoice price"
          label="Sale price"
          tone="green"
          value={money.format(Number(product.salePrice))}
        />
        <MetricCard
          helper={product.type === "service" ? "No stock tracking" : "On hand"}
          label="Stock"
          tone={isLowStock ? "amber" : "blue"}
          value={
            product.type === "service"
              ? "Service"
              : `${decimalText(product.stockQuantity)} ${
                  product.unit || "units"
                }`
          }
        />
        <MetricCard
          helper="Value of recent invoice lines"
          label="Sales value"
          tone="green"
          value={money.format(salesValue)}
        />
      </section>

      {isLowStock ? (
        <p className="rounded-[7px] border border-[#e24b4a]/30 bg-[#fcebeb] px-3 py-2 text-[11.5px] font-medium text-[#a32d2d]">
          Low stock warning: this item is at or below its alert threshold.
        </p>
      ) : null}

      <section className="grid gap-[11px] xl:grid-cols-[0.86fr_1.14fr]">
        <Card subtitle="Catalog details" title="Edit item">
          <ProductForm
            defaults={{
              category: product.category ?? "",
              costPrice: decimalInputValue(product.costPrice),
              description: product.description ?? "",
              lowStockAlert: decimalInputValue(product.lowStockAlert),
              name: product.name,
              salePrice: decimalInputValue(product.salePrice),
              sku: product.sku ?? "",
              status: product.status,
              stockQuantity: decimalInputValue(product.stockQuantity),
              taxRate: decimalInputValue(product.taxRate),
              type: product.type,
              unit: product.unit ?? "",
            }}
            productId={product.id}
            submitLabel="Update item"
          />
        </Card>

        <div className="grid content-start gap-[11px]">
          <Card subtitle="Inventory snapshot" title="Inventory summary">
            <dl className="grid gap-2 text-xs">
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">SKU</dt>
                <dd className="font-medium">{product.sku || "Not set"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">Cost price</dt>
                <dd className="font-mono font-medium">
                  {money.format(Number(product.costPrice))}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">Stock value</dt>
                <dd className="font-mono font-medium">{money.format(stockValue)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Sold quantity</dt>
                <dd className="font-mono font-medium">
                  {decimalText(totalSold)} {product.unit || "units"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card
            className="overflow-hidden"
            subtitle={`${product.inventoryMovements.length} records`}
            title="Stock ledger"
          >

            {product.inventoryMovements.length === 0 ? (
              <EmptyState
                description="Manual stock adjustments from the inventory screen will appear here."
                title="No stock moves yet"
              />
            ) : (
              <div className="max-h-[420px] overflow-y-auto overflow-x-hidden">
                <table className="responsive-data-table w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-[11px] text-[#94a3b8]">
                      <th className="pb-2 pr-4 font-normal">Type</th>
                      <th className="pb-2 pr-4 font-normal">Date</th>
                      <th className="pb-2 pr-4 text-right font-normal">
                        Quantity
                      </th>
                      <th className="pb-2 text-right font-normal">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.inventoryMovements.map((movement) => (
                      <tr
                        className="border-b border-border transition last:border-0 hover:bg-black/[0.015]"
                        key={movement.id}
                      >
                        <td className="py-2.5 pr-4 align-top" data-label="Type">
                          <MovementBadge type={movement.type} />
                          {movement.notes ? (
                            <p className="mt-2 text-[10.5px] text-[#94a3b8]">
                              {movement.notes}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-4 align-top text-muted-foreground" data-label="Date">
                          {dateFormatter(movement.createdAt)}
                        </td>
                        <td className="py-2.5 pr-4 text-right align-top font-mono font-medium" data-label="Quantity">
                          {decimalText(movement.quantity)}
                        </td>
                        <td className="py-2.5 text-right align-top font-mono" data-label="Cost">
                          {money.format(Number(movement.unitCost))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            className="overflow-hidden"
            subtitle={`${product.invoiceItems.length} records`}
            title="Recent invoice lines"
          >

            {product.invoiceItems.length === 0 ? (
              <EmptyState
                description="Invoice line history will appear here after this item is used."
                title="No invoice usage yet"
              />
            ) : (
              <div className="max-h-[420px] overflow-y-auto overflow-x-hidden">
                <table className="responsive-data-table w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-[11px] text-[#94a3b8]">
                      <th className="pb-2 pr-4 font-normal">Invoice</th>
                      <th className="pb-2 pr-4 font-normal">Customer</th>
                      <th className="pb-2 pr-4 font-normal">Date</th>
                      <th className="pb-2 pr-4 text-right font-normal">
                        Qty
                      </th>
                      <th className="pb-2 text-right font-normal">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.invoiceItems.map((item) => (
                      <tr
                        className="border-b border-border transition last:border-0 hover:bg-black/[0.015]"
                        key={item.id}
                      >
                        <td className="py-2.5 pr-4 align-top" data-label="Invoice">
                          <Link
                            className="font-medium text-[#185fa5]"
                            href={`/dashboard/invoices/${item.invoiceId}`}
                          >
                            {item.invoice.invoiceNumber}
                          </Link>
                          <p className="mt-1 capitalize text-[10.5px] text-[#94a3b8]">
                            {item.invoice.status}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4 align-top" data-label="Customer">
                          {item.invoice.customer?.name ?? "No customer"}
                        </td>
                        <td className="py-2.5 pr-4 align-top text-muted-foreground" data-label="Date">
                          {dateFormatter(item.invoice.invoiceDate)}
                        </td>
                        <td className="py-2.5 pr-4 text-right align-top font-mono" data-label="Qty">
                          {decimalText(item.quantity)}
                        </td>
                        <td className="py-2.5 text-right align-top font-mono font-medium" data-label="Total">
                          {money.format(Number(item.lineTotal))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
