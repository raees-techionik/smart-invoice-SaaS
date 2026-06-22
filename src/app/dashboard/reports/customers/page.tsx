import Link from "next/link";

import { requireReportViewer } from "@/app/_backend/lib/auth/roles";
import { buildCustomerSalesReportData } from "@/app/_backend/lib/report-exports";

type CustomerSalesReportPageProps = {
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

function dateFormatter() {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
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

export default async function CustomerSalesReportPage({
  searchParams,
}: CustomerSalesReportPageProps) {
  const user = await requireReportViewer();
  const params = await searchParams;
  const report = await buildCustomerSalesReportData(user.businessId, {
    from: params.from,
    to: params.to,
  });
  const money = currencyFormatter(report.business.currency);
  const dates = dateFormatter();
  const xlsxHref = `/dashboard/reports/customers/xlsx?${new URLSearchParams({
    from: report.fromInput,
    to: report.toInput,
  })}`;
  const topCustomer = report.rows[0];

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Reports
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Customer-wise sales
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Review gross sales, refunds, paid amounts, payments received, and
            outstanding balances by customer.
          </p>
        </div>
        <form
          action="/dashboard/reports/customers"
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
            href="/dashboard/reports/customers"
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
          helper="Current paid amount on invoices"
          label="Paid"
          value={money.format(report.totals.paidAmount)}
        />
        <MetricCard
          helper="Current balance on invoices"
          label="Outstanding"
          tone="warn"
          value={money.format(report.totals.balanceAmount)}
        />
        <MetricCard
          helper={topCustomer?.customerName ?? "No customer activity"}
          label="Top customer"
          value={topCustomer ? money.format(topCustomer.netSales) : money.format(0)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold">Report basis</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sales and invoice balances use invoice date. Payments use payment
            date. Refunds use refund date.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/sales"
          >
            Sales trend
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/receivables"
          >
            Receivables
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
              Customer performance
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              {report.totals.customerCount} customers
            </h3>
          </div>
          <span className="text-sm text-muted-foreground">
            Sorted by net sales
          </span>
        </div>

        {report.rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">No customer sales in range</p>
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
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 text-right font-semibold">Invoices</th>
                  <th className="px-5 py-3 text-right font-semibold">Gross sales</th>
                  <th className="px-5 py-3 text-right font-semibold">Refunds</th>
                  <th className="px-5 py-3 text-right font-semibold">Net sales</th>
                  <th className="px-5 py-3 text-right font-semibold">Paid</th>
                  <th className="px-5 py-3 text-right font-semibold">Payments</th>
                  <th className="px-5 py-3 text-right font-semibold">Outstanding</th>
                  <th className="px-5 py-3 text-right font-semibold">Avg invoice</th>
                  <th className="px-5 py-3 font-semibold">Last invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.rows.map((row) => (
                  <tr
                    className="transition hover:bg-[#e6f1fb]/40"
                    key={row.customerId ?? "no-customer"}
                  >
                    <td className="px-5 py-4" data-label="Customer">
                      <div className="font-semibold">
                        {row.customerId ? (
                          <Link
                            className="transition hover:text-accent"
                            href={`/dashboard/customers/${row.customerId}`}
                          >
                            {row.customerName}
                          </Link>
                        ) : (
                          row.customerName
                        )}
                      </div>
                      {row.businessName ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.businessName}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground" data-label="Contact">
                      <div>{row.phone ?? "No phone"}</div>
                      <div className="mt-1">{row.email ?? "No email"}</div>
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
                    <td className="px-5 py-4 text-right" data-label="Paid">
                      {money.format(row.paidAmount)}
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
                    <td className="px-5 py-4 text-muted-foreground" data-label="Last invoice">
                      {row.lastInvoiceDate
                        ? dates.format(row.lastInvoiceDate)
                        : "No invoice"}
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
