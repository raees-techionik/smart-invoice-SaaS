import Link from "next/link";

import { requireReportViewer } from "@/app/_backend/lib/auth/roles";
import { buildStockValuationReportData } from "@/app/_backend/lib/report-exports";

type StockValuationPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

function currencyFormatter(currency: string) {
  return new Intl.NumberFormat("en-PK", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  });
}

function quantityFormatter(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function stockStatusTone(value: string) {
  if (value === "negative_stock" || value === "out_of_stock") {
    return "bg-red-50 text-red-700";
  }

  if (value === "low_stock") {
    return "bg-amber-50 text-amber-800";
  }

  return "bg-[#eaf3de] text-[#3b6d11]";
}

function MetricCard({
  helper,
  label,
  tone = "neutral",
  value,
}: {
  helper: string;
  label: string;
  tone?: "good" | "neutral" | "warn";
  value: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-accent"
      : tone === "warn"
        ? "text-warning"
        : "text-foreground";

  return (
    <div className="rounded-[14px] border border-border bg-white p-[15px]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className={`font-mono text-[21px] font-medium leading-none ${toneClass}`}>
        {value}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

export default async function StockValuationPage({
  searchParams,
}: StockValuationPageProps) {
  const user = await requireReportViewer();
  const params = await searchParams;
  const report = await buildStockValuationReportData(user.businessId, {
    status: params.status,
  });
  const money = currencyFormatter(report.business.currency);
  const xlsxHref = `/dashboard/reports/stock/xlsx?${new URLSearchParams({
    status: report.selectedStatus,
  })}`;
  const attentionCount =
    report.totals.lowStockItems +
    report.totals.outOfStockItems +
    report.totals.negativeStockItems;

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Reports
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Stock valuation
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Review on-hand inventory quantity, cost value, retail value, and
            low-stock signals for product stock.
          </p>
        </div>
        <form
          action="/dashboard/reports/stock"
          className="grid gap-2 sm:grid-cols-[140px_auto_auto_auto]"
        >
          <select
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={report.selectedStatus}
            name="status"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
            type="submit"
          >
            Apply
          </button>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href={xlsxHref}
          >
            Download XLSX
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/stock"
          >
            Reset
          </Link>
        </form>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          helper={`${report.rows.length} ${report.selectedStatus} stock items`}
          label="Stock value"
          tone="good"
          value={money.format(report.totals.totalCostValue)}
        />
        <MetricCard
          helper="Quantity multiplied by sale price"
          label="Retail value"
          value={money.format(report.totals.totalRetailValue)}
        />
        <MetricCard
          helper="Current on-hand quantity"
          label="Total units"
          value={quantityFormatter(report.totals.totalUnits)}
        />
        <MetricCard
          helper="At or below alert threshold"
          label="Low stock"
          tone={report.totals.lowStockItems > 0 ? "warn" : "good"}
          value={String(report.totals.lowStockItems)}
        />
        <MetricCard
          helper="Quantity is zero"
          label="Out of stock"
          tone={report.totals.outOfStockItems > 0 ? "warn" : "good"}
          value={String(report.totals.outOfStockItems)}
        />
        <MetricCard
          helper="Low, out, or negative stock"
          label="Needs attention"
          tone={attentionCount > 0 ? "warn" : "good"}
          value={String(attentionCount)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold">Report basis</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock value is calculated from current on-hand quantity multiplied
            by current cost price. Retail value uses current sale price.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/inventory"
          >
            Inventory
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/products"
          >
            Product profitability
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/sales"
          >
            Sales trend
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
        <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Product stock values
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              Quantity and valuation
            </h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {report.rows.length} products
          </span>
        </div>

        {report.rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">No stock products found</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Add product inventory or switch the status filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="text-[11px] text-[#94a3b8]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">SKU</th>
                  <th className="px-5 py-3 text-right font-semibold">Stock</th>
                  <th className="px-5 py-3 text-right font-semibold">Alert</th>
                  <th className="px-5 py-3 text-right font-semibold">Cost</th>
                  <th className="px-5 py-3 text-right font-semibold">Sale</th>
                  <th className="px-5 py-3 text-right font-semibold">Value</th>
                  <th className="px-5 py-3 text-right font-semibold">Retail value</th>
                  <th className="px-5 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.rows.map((row) => (
                  <tr className="transition hover:bg-[#e6f1fb]/40" key={row.productId}>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{row.productName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.category || "Uncategorized"} / {row.unit || "unit"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {row.sku || "-"}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">
                      {quantityFormatter(row.stockQuantity)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {quantityFormatter(row.lowStockAlert)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {money.format(row.costPrice)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {money.format(row.salePrice)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">
                      {money.format(row.stockValue)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {money.format(row.stockQuantity * row.salePrice)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`inline-flex rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium capitalize ${stockStatusTone(row.stockStatus)}`}
                      >
                        {row.stockStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
