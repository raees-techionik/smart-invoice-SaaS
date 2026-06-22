import Link from "next/link";

import { requireReportViewer } from "@/app/_backend/lib/auth/roles";
import { buildPaymentCollectionReportData } from "@/app/_backend/lib/report-exports";

type PaymentCollectionReportPageProps = {
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
  tone?: "good" | "neutral";
  value: string;
}) {
  const toneClass = tone === "good" ? "text-accent" : "text-foreground";

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

export default async function PaymentCollectionReportPage({
  searchParams,
}: PaymentCollectionReportPageProps) {
  const user = await requireReportViewer();
  const params = await searchParams;
  const report = await buildPaymentCollectionReportData(user.businessId, {
    from: params.from,
    to: params.to,
  });
  const money = currencyFormatter(report.business.currency);
  const dates = dateFormatter();
  const xlsxHref = `/dashboard/reports/payments/xlsx?${new URLSearchParams({
    from: report.fromInput,
    to: report.toInput,
  })}`;
  const topMethod = report.methodRows[0];
  const topCustomer = report.customerRows[0];
  const latestPayment = report.detailRows[0];

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Reports
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Payment collection
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Review collected payments by method, customer, invoice, and payment
            date.
          </p>
        </div>
        <form
          action="/dashboard/reports/payments"
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
            href="/dashboard/reports/payments"
          >
            Reset
          </Link>
        </form>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          helper={`${report.totals.paymentCount} payment records`}
          label="Collected"
          tone="good"
          value={money.format(report.totals.totalAmount)}
        />
        <MetricCard
          helper="Average collected payment"
          label="Average"
          value={money.format(report.totals.averagePaymentAmount)}
        />
        <MetricCard
          helper="Customers with payments in range"
          label="Customers"
          value={String(report.totals.customerCount)}
        />
        <MetricCard
          helper={topMethod?.paymentMethod ?? "No payment activity"}
          label="Top method"
          value={topMethod ? money.format(topMethod.totalAmount) : money.format(0)}
        />
        <MetricCard
          helper={topCustomer?.customerName ?? "No customer payments"}
          label="Top customer"
          value={
            topCustomer ? money.format(topCustomer.totalAmount) : money.format(0)
          }
        />
        <MetricCard
          helper={
            latestPayment
              ? dates.format(latestPayment.paymentDate)
              : "No payment activity"
          }
          label="Latest payment"
          tone="good"
          value={latestPayment ? money.format(latestPayment.amount) : money.format(0)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold">Report basis</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Collections are grouped by payment date and include only recorded
            payment entries.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/payments"
          >
            Payments
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/customers"
          >
            Customer sales
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/receivables"
          >
            Receivables
          </Link>
        </div>
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Method summary
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                {report.totals.methodCount} methods
              </h3>
            </div>
            <span className="text-sm text-muted-foreground">
              Sorted by collection
            </span>
          </div>

          {report.methodRows.length === 0 ? (
            <div className="grid min-h-56 place-items-center p-8 text-center">
              <div>
                <p className="text-lg font-semibold">No payments in range</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Record payments or widen the report date range.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {report.methodRows.map((row) => (
                <div
                  className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"
                  key={row.paymentMethod}
                >
                  <div>
                    <p className="font-semibold capitalize">
                      {row.paymentMethod}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.paymentCount} payments /{" "}
                      {row.percentOfCollection.toFixed(2)}%
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold">
                      {money.format(row.totalAmount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Avg {money.format(row.averagePaymentAmount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Customer collections
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                {report.totals.customerCount} customers
              </h3>
            </div>
            <span className="text-sm text-muted-foreground">
              Sorted by collection
            </span>
          </div>

          {report.customerRows.length === 0 ? (
            <div className="grid min-h-56 place-items-center p-8 text-center">
              <div>
                <p className="text-lg font-semibold">No customer payments</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Payment collections will appear here after payments are
                  recorded.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
              <table className="responsive-data-table w-full border-collapse text-left text-sm">
                <thead className="text-[11px] text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 text-right font-semibold">Invoices</th>
                    <th className="px-5 py-3 text-right font-semibold">Payments</th>
                    <th className="px-5 py-3 text-right font-semibold">Collected</th>
                    <th className="px-5 py-3 font-semibold">Last payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.customerRows.map((row) => (
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
                      <td className="px-5 py-4 text-right" data-label="Payments">
                        {row.paymentCount}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold" data-label="Collected">
                        {money.format(row.totalAmount)}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground" data-label="Last payment">
                        {row.lastPaymentDate
                          ? dates.format(row.lastPaymentDate)
                          : "No payment"}
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
