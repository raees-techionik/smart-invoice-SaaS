import { Prisma } from "@prisma/client";
import Link from "next/link";

import { ProductForm } from "@/app/_frontend/components/dashboard/product-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function currencyFormatter(currency: string) {
  return new Intl.NumberFormat("en-PK", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  });
}

function decimalText(value: Prisma.Decimal | number) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(2);
}

function isLowStock(product: {
  lowStockAlert: Prisma.Decimal;
  stockQuantity: Prisma.Decimal;
  type: string;
}) {
  return (
    product.type === "product" &&
    Number(product.lowStockAlert) > 0 &&
    Number(product.stockQuantity) <= Number(product.lowStockAlert)
  );
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
    amber: "bg-[#fff7ed] text-[#b45309]",
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    green: "bg-[#ecfdf5] text-[#047857]",
  };
  const toneLineClasses = {
    amber: "from-[#f59e0b] to-[#f97316]",
    blue: "from-[#635bff] to-[#22d3ee]",
    green: "from-[#00a884] to-[#6ee7b7]",
  };

  return (
    <div className="premium-card premium-card-hover relative overflow-hidden rounded-[16px] border p-3.5">
      <div
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${toneLineClasses[tone]}`}
      />
      <div
        className={`premium-stat-icon mb-2 grid size-7 place-items-center rounded-lg text-[10.5px] font-semibold ${toneClasses[tone]}`}
      >
        {label.slice(0, 2).toUpperCase()}
      </div>
      <p className="font-mono text-[20px] font-medium leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[10.5px] text-[#94a3b8]">{helper}</p>
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
        <div className="premium-visual-coin">BX</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";

  return (
    <span
      className={`inline-flex rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium capitalize ${
        active
          ? "bg-[#eaf3de] text-[#3b6d11]"
          : "border border-border bg-[#f8f9fa] text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const user = await requireUser();
  const { q } = await searchParams;
  const search = q?.trim() ?? "";
  const money = currencyFormatter(user.business.currency);

  const where: Prisma.ProductWhereInput = {
    businessId: user.businessId,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
            { category: { contains: search } },
          ],
        }
      : {}),
  };

  const [products, totalProducts, activeProducts, stockItems] =
    await Promise.all([
      prisma.product.findMany({
        include: {
          _count: {
            select: {
              invoiceItems: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 25,
        where,
      }),
      prisma.product.count({
        where: {
          businessId: user.businessId,
        },
      }),
      prisma.product.count({
        where: {
          businessId: user.businessId,
          status: "active",
        },
      }),
      prisma.product.findMany({
        select: {
          lowStockAlert: true,
          stockQuantity: true,
          type: true,
        },
        where: {
          businessId: user.businessId,
          status: "active",
          type: "product",
        },
      }),
    ]);

  const lowStockItems = stockItems.filter(isLowStock).length;

  return (
    <div className="relative grid gap-3">
      <PremiumVisual />
      <header className="premium-card relative z-[1] grid gap-4 overflow-hidden rounded-[16px] border p-3.5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#635bff]">
            Products
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Products and services
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Build the catalog that invoice line items, stock movement, and
            pricing defaults will use.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <form action="/dashboard/products" className="flex gap-2">
            <input
              className="h-[34px] min-w-0 rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
              defaultValue={search}
              name="q"
              placeholder="Search items"
            />
            <button
              className="premium-button h-[34px] rounded-lg px-4 text-[12px] font-medium text-white transition hover:brightness-105"
              type="submit"
            >
              Search
            </button>
          </form>
          <Link
            className="premium-soft-button inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition hover:border-[#635bff]/30 hover:bg-white"
            href="/dashboard/inventory"
          >
            Inventory
          </Link>
        </div>
      </header>

      <section className="relative z-[1] grid gap-3 md:grid-cols-3">
        <MetricCard
          helper="Products and services in the catalog."
          label="Total items"
          tone="blue"
          value={String(totalProducts)}
        />
        <MetricCard
          helper="Selectable on new invoices."
          label="Active items"
          tone="green"
          value={String(activeProducts)}
        />
        <MetricCard
          helper="Products at or below alert levels."
          label="Low-stock items"
          tone={lowStockItems > 0 ? "amber" : "green"}
          value={String(lowStockItems)}
        />
      </section>

      <section className="relative z-[1] grid gap-3 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="premium-card rounded-[16px] border p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-4">
            <h3 className="text-[13px] font-medium">New catalog item</h3>
            <span className="text-[11px] text-[#94a3b8]">Product/service</span>
          </div>
          <ProductForm />
        </div>

        <div className="premium-card overflow-hidden rounded-[16px] border p-3.5">
          <div className="mb-2.5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 className="text-[13px] font-medium">
                {search ? `Matches for "${search}"` : "Latest items"}
            </h3>
            <span className="text-[11px] text-[#94a3b8]">
              Showing {products.length} of {search ? "matching" : "latest"}{" "}
              records
            </span>
          </div>

          {products.length === 0 ? (
            <div className="grid min-h-40 place-items-center text-center">
              <div>
                <p className="text-sm font-medium">
                  {search ? "No matching items" : "No products or services yet"}
                </p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  {search
                    ? "Try an item name, SKU, or category."
                    : "Create the first catalog item so invoices can pull in real prices next."}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] text-[#94a3b8]">
                    <th className="pb-2 pr-4 font-normal">Item</th>
                    <th className="pb-2 pr-4 font-normal">Type</th>
                    <th className="pb-2 pr-4 text-right font-normal">Price</th>
                    <th className="pb-2 pr-4 text-right font-normal">Stock</th>
                    <th className="pb-2 pr-4 text-right font-normal">Tax</th>
                    <th className="pb-2 pr-4 text-right font-normal">Used</th>
                    <th className="pb-2 text-right font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const lowStock = isLowStock(product);

                    return (
                      <tr
                        className="border-b border-border transition last:border-0 hover:bg-[#635bff]/[0.04]"
                        key={product.id}
                      >
                        <td className="py-2 pr-4 align-top">
                          <Link
                            className="font-medium text-[#185fa5]"
                            href={`/dashboard/products/${product.id}`}
                          >
                            {product.name}
                          </Link>
                          <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                            {product.sku || product.category || "No SKU"}
                          </p>
                        </td>
                        <td className="py-2 pr-4 align-top capitalize">
                          {product.type}
                        </td>
                        <td className="py-2 pr-4 text-right align-top">
                          <p className="font-mono font-medium">
                            {money.format(Number(product.salePrice))}
                          </p>
                          <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                            Cost {money.format(Number(product.costPrice))}
                          </p>
                        </td>
                        <td className="py-2 pr-4 text-right align-top">
                          {product.type === "service" ? (
                            <span className="text-muted-foreground">
                              Service
                            </span>
                          ) : (
                            <div>
                                <p className="font-mono font-medium">
                                {decimalText(product.stockQuantity)}{" "}
                                {product.unit || "units"}
                              </p>
                              {lowStock ? (
                                <p className="mt-1 inline-flex rounded-[5px] bg-[#fcebeb] px-2 py-0.5 text-[9.5px] font-medium text-[#a32d2d]">
                                  Low stock
                                </p>
                              ) : (
                                <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                                  Alert at {decimalText(product.lowStockAlert)}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right align-top font-mono">
                          {decimalText(product.taxRate)}%
                        </td>
                        <td className="py-2 pr-4 text-right align-top font-mono">
                          {product._count.invoiceItems}
                        </td>
                        <td className="py-2 text-right align-top">
                          <StatusBadge status={product.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
