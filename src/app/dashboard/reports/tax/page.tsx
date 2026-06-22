import Link from "next/link";

import { requireReportViewer } from "@/app/_backend/lib/auth/roles";
import { buildTaxSummaryReportData } from "@/app/_backend/lib/report-exports";

type TaxSummaryPageProps = {
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

function taxRateLabel(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}%`;
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

export default async function TaxSummaryPage({
  searchParams,
}: TaxSummaryPageProps) {
  const user = await requireReportViewer();
  const params = await searchParams;
  const report = await buildTaxSummaryReportData(user.businessId, {
    from: params.from,
    to: params.to,
  });
  const money = currencyFormatter(report.business.currency);
  const xlsxHref = `/dashboard/reports/tax/xlsx?${new URLSearchParams({
    from: report.fromInput,
    to: report.toInput,
  })}`;
  const maxNetTax = Math.max(
    ...report.rows.map((row) => Math.abs(row.netTax)),
    0,
  );

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Reports
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Tax summary
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Review taxable sales and tax collected by rate, adjusted for
            completed refunds in the selected date range.
          </p>
        </div>
        <form
          action="/dashboard/reports/tax"
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
            href="/dashboard/reports/tax"
          >
            Reset
          </Link>
        </form>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          helper="Invoice line value before tax"
          label="Taxable sales"
          tone="good"
          value={money.format(report.totals.taxableSales)}
        />
        <MetricCard
          helper="Tax from finalized invoice lines"
          label="Tax collected"
          tone="good"
          value={money.format(report.totals.taxCollected)}
        />
        <MetricCard
          helper="Tax reversed from completed refunds"
          label="Refunded tax"
          tone="warn"
          value={money.format(report.totals.refundedTax)}
        />
        <MetricCard
          helper="Taxable sales after refunds"
          label="Net taxable"
          value={money.format(report.totals.netTaxableSales)}
        />
        <MetricCard
          helper={`${report.rows.length} tax rates in range`}
          label="Net tax"
          tone={report.totals.netTax >= 0 ? "good" : "warn"}
          value={money.format(report.totals.netTax)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold">Report basis</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Draft invoices are excluded. Refund amounts are split back into
            taxable value and tax using the original invoice item tax rate.
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
            href="/dashboard/reports/products"
          >
            Product profitability
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
        <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Tax by rate
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              Collected, refunded, and net tax
            </h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {report.rows.length} records
          </span>
        </div>

        {report.rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">No tax activity in range</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Finalize invoices with taxable line items or widen the report
                date range.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-h-[640px] overflow-y-auto overflow-x-hidden">
            <table className="responsive-data-table w-full border-collapse text-left text-sm">
              <thead className="text-[11px] text-[#94a3b8]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tax rate</th>
                  <th className="px-5 py-3 text-right font-semibold">Gross sales</th>
                  <th className="px-5 py-3 text-right font-semibold">Taxable sales</th>
                  <th className="px-5 py-3 text-right font-semibold">Tax collected</th>
                  <th className="px-5 py-3 text-right font-semibold">Refunded taxable</th>
                  <th className="px-5 py-3 text-right font-semibold">Refunded tax</th>
                  <th className="px-5 py-3 text-right font-semibold">Net taxable</th>
                  <th className="px-5 py-3 text-right font-semibold">Net tax</th>
                  <th className="px-5 py-3 text-right font-semibold">Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.rows.map((row) => (
                  <tr className="transition hover:bg-[#e6f1fb]/40" key={row.taxRate}>
                    <td className="px-5 py-4" data-label="Tax rate">
                      <span className="rounded-[5px] border border-border bg-[#f8f9fa] px-2 py-0.5 text-[11px] font-semibold">
                        {taxRateLabel(row.taxRate)}
                      </span>
                      <div className="mt-2 h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{
                            width:
                              maxNetTax > 0
                                ? `${Math.round((Math.abs(row.netTax) / maxNetTax) * 100)}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right" data-label="Gross sales">
                      {money.format(row.grossSales)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold" data-label="Taxable sales">
                      {money.format(row.taxableSales)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold" data-label="Tax collected">
                      {money.format(row.taxCollected)}
                    </td>
                    <td className="px-5 py-4 text-right" data-label="Refunded taxable">
                      {money.format(row.refundedTaxableSales)}
                    </td>
                    <td className="px-5 py-4 text-right" data-label="Refunded tax">
                      {money.format(row.refundedTax)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold" data-label="Net taxable">
                      {money.format(row.netTaxableSales)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold" data-label="Net tax">
                      {money.format(row.netTax)}
                    </td>
                    <td className="px-5 py-4 text-right text-muted-foreground" data-label="Invoices">
                      {row.invoiceCount}
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
