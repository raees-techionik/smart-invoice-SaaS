import Link from "next/link";

import { requireReportViewer } from "@/app/_backend/lib/auth/roles";
import { buildProductProfitabilityReportData } from "@/app/_backend/lib/report-exports";

type ProductProfitabilityPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
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

function marginTone(value: number) {
  if (value < 0) {
    return "bg-red-50 text-red-700";
  }

  if (value < 20) {
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

export default async function ProductProfitabilityPage({
  searchParams,
}: ProductProfitabilityPageProps) {
  const user = await requireReportViewer();
  const params = await searchParams;
  const report = await buildProductProfitabilityReportData(user.businessId, {
    from: params.from,
    to: params.to,
  });
  const money = currencyFormatter(report.business.currency);
  const xlsxHref = `/dashboard/reports/products/xlsx?${new URLSearchParams({
    from: report.fromInput,
    to: report.toInput,
  })}`;
  const overallMargin =
    report.totals.netRevenue > 0
      ? Math.round((report.totals.profit / report.totals.netRevenue) * 10000) / 100
      : 0;
  const bestProduct = report.rows[0];
  const lossCount = report.rows.filter((row) => row.profit < 0).length;

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Reports
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Product profitability
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Compare sold quantity, refunds, net product revenue, estimated cost,
            and product-level margin for finalized invoices.
          </p>
        </div>
        <form
          action="/dashboard/reports/products"
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
        >
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={report.fromInput}
            name="from"
            type="date"
          />
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={report.toInput}
            name="to"
            type="date"
          />
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
            href="/dashboard/reports/products"
          >
            Reset
          </Link>
        </form>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          helper={`${report.rows.length} products/services sold`}
          label="Net revenue"
          tone="good"
          value={money.format(report.totals.netRevenue)}
        />
        <MetricCard
          helper="Based on current product cost price"
          label="Estimated cost"
          tone="warn"
          value={money.format(report.totals.netCost)}
        />
        <MetricCard
          helper={`${overallMargin}% margin`}
          label="Estimated profit"
          tone={report.totals.profit >= 0 ? "good" : "warn"}
          value={money.format(report.totals.profit)}
        />
        <MetricCard
          helper={`${quantityFormatter(report.totals.quantitySold)} sold`}
          label="Net quantity"
          value={quantityFormatter(report.totals.netQuantity)}
        />
        <MetricCard
          helper={`${quantityFormatter(report.totals.quantityRefunded)} refunded`}
          label="Refund revenue"
          tone="warn"
          value={money.format(report.totals.refundRevenue)}
        />
        <MetricCard
          helper={bestProduct ? bestProduct.itemName : "No product sales"}
          label="Top product"
          value={bestProduct ? money.format(bestProduct.profit) : money.format(0)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold">Report basis</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenue excludes tax collected. Completed refunds in the selected
            date range reduce product revenue and quantity. Estimated cost uses
            each product&apos;s current cost price.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports"
          >
            Profit and loss
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/refunds"
          >
            Refund summary
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
        <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Product performance
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              Revenue, cost, and margin
            </h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {lossCount} products below zero profit
          </span>
        </div>

        {report.rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">No product sales in range</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Finalize invoices or widen the report date range to see
                profitability.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="text-[11px] text-[#94a3b8]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">SKU</th>
                  <th className="px-5 py-3 text-right font-semibold">Sold</th>
                  <th className="px-5 py-3 text-right font-semibold">Refunded</th>
                  <th className="px-5 py-3 text-right font-semibold">Net qty</th>
                  <th className="px-5 py-3 text-right font-semibold">Net revenue</th>
                  <th className="px-5 py-3 text-right font-semibold">Cost</th>
                  <th className="px-5 py-3 text-right font-semibold">Profit</th>
                  <th className="px-5 py-3 text-right font-semibold">Margin</th>
                  <th className="px-5 py-3 text-right font-semibold">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.rows.map((row) => (
                  <tr className="transition hover:bg-[#e6f1fb]/40" key={row.productId ?? row.itemName}>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{row.itemName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.category || "Uncategorized"} / {row.unit || "unit"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {row.sku || "-"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {quantityFormatter(row.quantitySold)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {quantityFormatter(row.quantityRefunded)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">
                      {quantityFormatter(row.netQuantity)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">
                      {money.format(row.netRevenue)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {money.format(row.netCost)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">
                      {money.format(row.profit)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`inline-flex rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium ${marginTone(row.margin)}`}
                      >
                        {row.margin.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-muted-foreground">
                      {row.stockQuantity === null
                        ? "-"
                        : quantityFormatter(row.stockQuantity)}
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
