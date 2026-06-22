import Link from "next/link";

import { requireReportViewer } from "@/app/_backend/lib/auth/roles";
import { buildSalesTrendReportData } from "@/app/_backend/lib/report-exports";

type SalesReportPageProps = {
  searchParams: Promise<{
    from?: string;
    mode?: string;
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

export default async function SalesReportPage({
  searchParams,
}: SalesReportPageProps) {
  const user = await requireReportViewer();
  const params = await searchParams;
  const report = await buildSalesTrendReportData(user.businessId, {
    from: params.from,
    mode: params.mode,
    to: params.to,
  });
  const money = currencyFormatter(report.business.currency);
  const xlsxHref = `/dashboard/reports/sales/xlsx?${new URLSearchParams({
    from: report.fromInput,
    mode: report.mode,
    to: report.toInput,
  })}`;
  const bestPeriod = [...report.rows].sort(
    (left, right) => right.netSales - left.netSales,
  )[0];

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Reports
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Daily / monthly sales
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Track finalized sales, refunds, payments received, and outstanding
            balances by day or month.
          </p>
        </div>
        <form
          action="/dashboard/reports/sales"
          className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto_auto_auto]"
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
          <select
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={report.mode}
            name="mode"
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
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
            href="/dashboard/reports/sales"
          >
            Reset
          </Link>
        </form>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          helper={`${report.totals.invoiceCount} finalized invoices`}
          label="Gross sales"
          tone="good"
          value={money.format(report.totals.grossSales)}
        />
        <MetricCard
          helper={`${report.totals.refundCount} completed refunds`}
          label="Refunds"
          tone="warn"
          value={money.format(report.totals.refundAmount)}
        />
        <MetricCard
          helper="Gross sales minus refunds"
          label="Net sales"
          tone="good"
          value={money.format(report.totals.netSales)}
        />
        <MetricCard
          helper="Payments recorded in range"
          label="Payments"
          value={money.format(report.totals.paymentsReceived)}
        />
        <MetricCard
          helper="Current balance on invoices in range"
          label="Outstanding"
          tone="warn"
          value={money.format(report.totals.balanceAmount)}
        />
        <MetricCard
          helper={bestPeriod?.periodLabel ?? "No sales activity"}
          label="Best period"
          value={bestPeriod ? money.format(bestPeriod.netSales) : money.format(0)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold">Report basis</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sales are grouped by invoice date. Payments are grouped by payment
            date. Refunds are grouped by refund date.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/products"
          >
            Product profitability
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/tax"
          >
            Tax summary
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/receivables"
          >
            Receivables
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
        <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Sales trend
            </p>
            <h3 className="mt-1 text-[13px] font-medium capitalize">
              {report.mode} performance
            </h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {report.rows.length} periods
          </span>
        </div>

        {report.rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">No sales activity in range</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Finalize invoices, record payments, or widen the report date
                range.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-h-[640px] overflow-y-auto overflow-x-hidden">
            <table className="responsive-data-table w-full border-collapse text-left text-sm">
              <thead className="text-[11px] text-[#94a3b8]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Period</th>
                  <th className="px-5 py-3 text-right font-semibold">Invoices</th>
                  <th className="px-5 py-3 text-right font-semibold">Gross sales</th>
                  <th className="px-5 py-3 text-right font-semibold">Refunds</th>
                  <th className="px-5 py-3 text-right font-semibold">Net sales</th>
                  <th className="px-5 py-3 text-right font-semibold">Payments</th>
                  <th className="px-5 py-3 text-right font-semibold">Outstanding</th>
                  <th className="px-5 py-3 text-right font-semibold">Avg invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.rows.map((row) => (
                  <tr className="transition hover:bg-[#e6f1fb]/40" key={row.periodKey}>
                    <td className="px-5 py-4 font-semibold" data-label="Period">
                      {row.periodLabel}
                    </td>
                    <td className="px-5 py-4 text-right" data-label="Invoices">
                      {row.invoiceCount}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold" data-label="Gross sales">
                      {money.format(row.grossSales)}
                    </td>
                    <td className="px-5 py-4 text-right" data-label="Refunds">
                      {money.format(row.refundAmount)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold" data-label="Net sales">
                      {money.format(row.netSales)}
                    </td>
                    <td className="px-5 py-4 text-right" data-label="Payments">
                      {money.format(row.paymentsReceived)}
                    </td>
                    <td className="px-5 py-4 text-right" data-label="Outstanding">
                      {money.format(row.balanceAmount)}
                    </td>
                    <td className="px-5 py-4 text-right text-muted-foreground" data-label="Avg invoice">
                      {money.format(row.averageInvoiceValue)}
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
