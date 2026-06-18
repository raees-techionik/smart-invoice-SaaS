import { Prisma } from "@prisma/client";
import Link from "next/link";

import { InventoryAdjustmentForm } from "@/app/_frontend/components/dashboard/inventory-adjustment-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

type InventoryPageProps = {
  searchParams: Promise<{
    from?: string;
    productId?: string;
    to?: string;
    type?: string;
  }>;
};

const movementTypeOptions = [
  { label: "All movement types", value: "" },
  { label: "Stock in", value: "stock_in" },
  { label: "Stock out", value: "stock_out" },
  { label: "Physical adjustment", value: "adjustment" },
  { label: "Invoice deduction", value: "invoice_deduction" },
  { label: "Refund return", value: "refund_return" },
];

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

function dateValue(value: string | undefined, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(`${value}${suffix}`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function decimalText(value: Prisma.Decimal | number | string) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(2);
}

function isLowStock(product: {
  lowStockAlert: Prisma.Decimal;
  stockQuantity: Prisma.Decimal;
}) {
  return (
    Number(product.lowStockAlert) > 0 &&
    Number(product.stockQuantity) <= Number(product.lowStockAlert)
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  helper: string;
  label: string;
  tone: "amber" | "blue" | "green" | "red";
  value: string;
}) {
  const toneClasses = {
    amber: "bg-[#fff7ed] text-[#b45309]",
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    green: "bg-[#ecfdf5] text-[#047857]",
    red: "bg-[#fef2f2] text-[#b91c1c]",
  };
  const toneLineClasses = {
    amber: "from-[#f59e0b] to-[#f97316]",
    blue: "from-[#635bff] to-[#22d3ee]",
    green: "from-[#00a884] to-[#6ee7b7]",
    red: "from-[#ef4444] to-[#fb7185]",
  };

  return (
    <div className="premium-card premium-card-hover relative overflow-hidden rounded-[16px] border p-[15px]">
      <div
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${toneLineClasses[tone]}`}
      />
      <div
        className={`premium-stat-icon mb-3 grid size-7 place-items-center rounded-lg text-[10.5px] font-semibold ${toneClasses[tone]}`}
      >
        {label.slice(0, 2).toUpperCase()}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-[21px] font-medium leading-none">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

function PremiumVisual() {
  return (
    <div className="premium-visual hidden xl:block" aria-hidden="true">
      <div className="premium-visual-rig">
        <div className="premium-visual-floor" />
        <div className="premium-visual-sheet" />
        <div className="premium-visual-cube" />
        <div className="premium-visual-coin">ST</div>
      </div>
    </div>
  );
}

function MovementBadge({ type }: { type: string }) {
  const style =
    type === "stock_in" || type === "refund_return"
      ? "bg-[#ecfdf5] text-[#047857]"
      : type === "stock_out" || type === "invoice_deduction"
        ? "bg-red-50 text-red-700"
        : "bg-[#eef2ff] text-[#4f46e5]";

  return (
    <span
      className={`inline-flex rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium capitalize ${style}`}
    >
      {type.replace(/_/g, " ")}
    </span>
  );
}

function movementTypeLabel(type: string) {
  return (
    movementTypeOptions.find((option) => option.value === type)?.label ??
    type.replace(/_/g, " ")
  );
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const user = await requireUser();
  const { from, productId, to, type } = await searchParams;
  const money = currencyFormatter(user.business.currency);
  const selectedType = movementTypeOptions.some((option) => option.value === type)
    ? type ?? ""
    : "";
  const fromDate = dateValue(from);
  const toDate = dateValue(to, true);
  const movementWhere: Prisma.InventoryMovementWhereInput = {
    businessId: user.businessId,
    ...(productId ? { productId } : {}),
    ...(selectedType ? { type: selectedType } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const [products, movements, summaryMovements] = await Promise.all([
    prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
      where: {
        businessId: user.businessId,
        status: "active",
        type: "product",
      },
    }),
    prisma.inventoryMovement.findMany({
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
        product: {
          select: {
            name: true,
            sku: true,
            unit: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      where: movementWhere,
    }),
    prisma.inventoryMovement.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            stockQuantity: true,
            unit: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      where: movementWhere,
    }),
  ]);

  const lowStockProducts = products.filter(isLowStock);
  const valuation = products.reduce(
    (total, product) =>
      total + Number(product.stockQuantity) * Number(product.costPrice),
    0,
  );
  const totalUnits = products.reduce(
    (total, product) => total + Number(product.stockQuantity),
    0,
  );
  const productOptions = products.map((product) => ({
    costPrice: decimalText(product.costPrice),
    id: product.id,
    name: product.name,
    sku: product.sku ?? "",
    stockQuantity: decimalText(product.stockQuantity),
    unit: product.unit ?? "",
  }));
  const selectedProductId = products.some((product) => product.id === productId)
    ? productId
    : undefined;
  const movementSummary = Array.from(
    summaryMovements
      .reduce(
        (summary, movement) => {
          const existing = summary.get(movement.productId) ?? {
            count: 0,
            name: movement.product.name,
            net: 0,
            onHand: Number(movement.product.stockQuantity),
            productId: movement.productId,
            sku: movement.product.sku ?? "",
            stockIn: 0,
            stockOut: 0,
            unit: movement.product.unit || "units",
          };
          const quantity = Number(movement.quantity);

          existing.count += 1;
          existing.net += quantity;

          if (quantity >= 0) {
            existing.stockIn += quantity;
          } else {
            existing.stockOut += Math.abs(quantity);
          }

          summary.set(movement.productId, existing);

          return summary;
        },
        new Map<
          string,
          {
            count: number;
            name: string;
            net: number;
            onHand: number;
            productId: string;
            sku: string;
            stockIn: number;
            stockOut: number;
            unit: string;
          }
        >(),
      )
      .values(),
  ).sort((left, right) => Math.abs(right.net) - Math.abs(left.net));
  const filterSummary = [
    selectedType ? movementTypeLabel(selectedType) : "All movement types",
    selectedProductId
      ? products.find((product) => product.id === selectedProductId)?.name
      : "All products",
    from ? `From ${from}` : null,
    to ? `To ${to}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
  const xlsxParams = new URLSearchParams();

  if (selectedProductId) {
    xlsxParams.set("productId", selectedProductId);
  }

  if (selectedType) {
    xlsxParams.set("type", selectedType);
  }

  if (from) {
    xlsxParams.set("from", from);
  }

  if (to) {
    xlsxParams.set("to", to);
  }

  const xlsxHref = `/dashboard/inventory/xlsx${
    xlsxParams.size > 0 ? `?${xlsxParams.toString()}` : ""
  }`;

  return (
    <div className="relative grid gap-3.5">
      <PremiumVisual />
      <header className="premium-card relative z-[1] flex flex-col gap-4 overflow-hidden rounded-[16px] border p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#635bff]">
            Inventory
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Stock control
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Record stock in, stock out, and physical count adjustments while
            keeping a clean movement ledger for every product.
          </p>
        </div>
        <Link
          className="premium-soft-button inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition hover:border-[#635bff]/30 hover:bg-white"
          href="/dashboard/products"
        >
          Back to products
        </Link>
      </header>

      <section className="relative z-[1] grid gap-4 md:grid-cols-4">
        <MetricCard
          helper="Active products with stock tracking"
          label="Stock items"
          tone="blue"
          value={String(products.length)}
        />
        <MetricCard
          helper="Current on-hand quantity"
          label="Total units"
          tone="green"
          value={decimalText(totalUnits)}
        />
        <MetricCard
          helper="On-hand stock at cost"
          label="Valuation"
          tone="amber"
          value={money.format(valuation)}
        />
        <MetricCard
          helper="At or below alert threshold"
          label="Low stock"
          tone="red"
          value={String(lowStockProducts.length)}
        />
      </section>

      <section className="relative z-[1] grid gap-3.5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="premium-card rounded-[16px] border p-4">
          <div className="mb-5">
            <p className="text-sm font-medium text-muted-foreground">
              Stock movement
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Adjust inventory</h3>
          </div>
          {productOptions.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border bg-[#f8f9fa] p-6 text-sm leading-6 text-muted-foreground">
              Create an active product before recording inventory movement.
            </div>
          ) : (
            <InventoryAdjustmentForm
              products={productOptions}
              selectedProductId={selectedProductId}
            />
          )}
        </div>

        <div className="grid gap-3.5 content-start">
        <div className="premium-card overflow-hidden rounded-[16px] border p-4">
            <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Low-stock watchlist
                </p>
                <h3 className="mt-1 text-[13px] font-medium">Needs attention</h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {lowStockProducts.length} products
              </span>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="grid min-h-40 place-items-center p-8 text-center">
                <div>
                  <p className="text-lg font-semibold">No low-stock items</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Products will appear here once they reach their alert
                    threshold.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                  <thead className="text-[11px] text-[#94a3b8]">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Product</th>
                      <th className="px-5 py-3 text-right font-semibold">
                        On hand
                      </th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Alert
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lowStockProducts.map((product) => (
                      <tr
                        className="transition hover:bg-[#635bff]/[0.04]"
                        key={product.id}
                      >
                        <td className="px-5 py-4 align-top">
                          <Link
                            className="font-semibold text-accent hover:underline"
                            href={`/dashboard/products/${product.id}`}
                          >
                            {product.name}
                          </Link>
                          <p className="mt-1 text-muted-foreground">
                            {product.sku || product.category || "No SKU"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right align-top font-semibold">
                          {decimalText(product.stockQuantity)}{" "}
                          {product.unit || "units"}
                        </td>
                        <td className="px-5 py-4 text-right align-top text-muted-foreground">
                          {decimalText(product.lowStockAlert)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="relative z-[1] grid gap-3.5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="premium-card overflow-hidden rounded-[16px] border p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Movement report
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Filters and summary
              </h3>
            </div>
            <span className="text-sm text-muted-foreground">
              {filterSummary}
            </span>
          </div>

          <form
            action="/dashboard/inventory"
            className="grid gap-4 border-b border-border bg-white/45 p-5 md:grid-cols-2"
          >
            <label className="grid gap-2 text-sm font-medium text-foreground">
              Product
              <select
                className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition focus:border-accent"
                defaultValue={selectedProductId ?? ""}
                name="productId"
              >
                <option value="">All products</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.sku ? ` (${product.sku})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-foreground">
              Movement type
              <select
                className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition focus:border-accent"
                defaultValue={selectedType}
                name="type"
              >
                {movementTypeOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-foreground">
              From
              <input
                className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition focus:border-accent"
                defaultValue={from ?? ""}
                name="from"
                type="date"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-foreground">
              To
              <input
                className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition focus:border-accent"
                defaultValue={to ?? ""}
                name="to"
                type="date"
              />
            </label>

            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                className="premium-button inline-flex h-[34px] items-center justify-center rounded-lg px-3 text-[11.5px] font-medium text-white transition hover:brightness-105"
                type="submit"
              >
                Apply filters
              </button>
              <Link
                className="premium-soft-button inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition hover:border-[#635bff]/30 hover:bg-white"
                href={xlsxHref}
              >
                Download XLSX
              </Link>
              <Link
                className="premium-soft-button inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition hover:border-[#635bff]/30 hover:bg-white"
                href="/dashboard/inventory"
              >
                Clear
              </Link>
            </div>
          </form>

          {movementSummary.length === 0 ? (
            <div className="grid min-h-48 place-items-center p-8 text-center">
              <div>
                <p className="text-lg font-semibold">No summary available</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Adjust filters or record inventory movements to populate the
                  product summary.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="text-[11px] text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Product</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      In
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Out
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Net
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      On hand
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Moves
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movementSummary.map((summary) => (
                    <tr
                      className="transition hover:bg-[#635bff]/[0.04]"
                      key={summary.productId}
                    >
                      <td className="px-5 py-4 align-top">
                        <Link
                          className="font-semibold text-accent hover:underline"
                          href={`/dashboard/products/${summary.productId}`}
                        >
                          {summary.name}
                        </Link>
                        <p className="mt-1 text-muted-foreground">
                          {summary.sku || "No SKU"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right align-top font-semibold text-accent">
                        {decimalText(summary.stockIn)} {summary.unit}
                      </td>
                      <td className="px-5 py-4 text-right align-top font-semibold text-red-700">
                        {decimalText(summary.stockOut)} {summary.unit}
                      </td>
                      <td className="px-5 py-4 text-right align-top font-semibold">
                        {decimalText(summary.net)} {summary.unit}
                      </td>
                      <td className="px-5 py-4 text-right align-top">
                        {decimalText(summary.onHand)} {summary.unit}
                      </td>
                      <td className="px-5 py-4 text-right align-top text-muted-foreground">
                        {summary.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

          <div className="premium-card overflow-hidden rounded-[16px] border p-4">
            <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Movement ledger
                </p>
                <h3 className="mt-1 text-[13px] font-medium">Recent activity</h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {movements.length} records
              </span>
            </div>

            {movements.length === 0 ? (
              <div className="grid min-h-48 place-items-center p-8 text-center">
                <div>
                  <p className="text-lg font-semibold">No movements yet</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Stock changes recorded from this page will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                  <thead className="text-[11px] text-[#94a3b8]">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Product</th>
                      <th className="px-5 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 font-semibold">Source</th>
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Quantity
                      </th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Unit cost
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {movements.map((movement) => (
                      <tr
                        className="transition hover:bg-[#635bff]/[0.04]"
                        key={movement.id}
                      >
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold">
                            {movement.product.name}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {movement.product.sku || "No SKU"}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <MovementBadge type={movement.type} />
                          {movement.notes ? (
                            <p className="mt-2 text-muted-foreground">
                              {movement.notes}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 align-top">
                          {movement.invoice ? (
                            <Link
                              className="font-semibold text-accent hover:underline"
                              href={`/dashboard/invoices/${movement.invoice.id}`}
                            >
                              {movement.invoice.invoiceNumber}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              Manual
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top text-muted-foreground">
                          {dateFormatter(movement.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right align-top font-semibold">
                          {decimalText(movement.quantity)}{" "}
                          {movement.product.unit || "units"}
                        </td>
                        <td className="px-5 py-4 text-right align-top">
                          {money.format(Number(movement.unitCost))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
      </section>
    </div>
  );
}
