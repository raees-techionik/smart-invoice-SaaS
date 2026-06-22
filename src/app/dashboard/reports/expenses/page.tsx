import Link from "next/link";

import { requireReportViewer } from "@/app/_backend/lib/auth/roles";
import { buildExpenseCategoryReportData } from "@/app/_backend/lib/report-exports";

type ExpenseCategoryReportPageProps = {
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
  tone?: "neutral" | "warn";
  value: string;
}) {
  const toneClass = tone === "warn" ? "text-warning" : "text-foreground";

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

export default async function ExpenseCategoryReportPage({
  searchParams,
}: ExpenseCategoryReportPageProps) {
  const user = await requireReportViewer();
  const params = await searchParams;
  const report = await buildExpenseCategoryReportData(user.businessId, {
    from: params.from,
    to: params.to,
  });
  const money = currencyFormatter(report.business.currency);
  const dates = dateFormatter();
  const xlsxHref = `/dashboard/reports/expenses/xlsx?${new URLSearchParams({
    from: report.fromInput,
    to: report.toInput,
  })}`;
  const topCategory = report.rows[0];
  const lastExpense = report.detailRows[0];

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Reports
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Expense category
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Review active expenses by category, vendor concentration, payment
            method, and average cost.
          </p>
        </div>
        <form
          action="/dashboard/reports/expenses"
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
            href="/dashboard/reports/expenses"
          >
            Reset
          </Link>
        </form>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          helper={`${report.totals.expenseCount} active records`}
          label="Total expenses"
          tone="warn"
          value={money.format(report.totals.totalAmount)}
        />
        <MetricCard
          helper="Active categories in range"
          label="Categories"
          value={String(report.totals.categoryCount)}
        />
        <MetricCard
          helper="Average active expense record"
          label="Average expense"
          value={money.format(report.totals.averageExpenseAmount)}
        />
        <MetricCard
          helper={topCategory?.category ?? "No expense activity"}
          label="Top category"
          tone="warn"
          value={topCategory ? money.format(topCategory.totalAmount) : money.format(0)}
        />
        <MetricCard
          helper={topCategory?.topVendor ?? "No vendor recorded"}
          label="Top vendor"
          value={
            topCategory
              ? money.format(topCategory.topVendorAmount)
              : money.format(0)
          }
        />
        <MetricCard
          helper={
            lastExpense ? dates.format(lastExpense.date) : "No expense activity"
          }
          label="Latest expense"
          value={lastExpense ? money.format(lastExpense.amount) : money.format(0)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold">Report basis</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Only active expenses are included. Archived expenses are excluded
            from this report and profit/loss calculations.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports"
          >
            Profit / loss
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/expenses"
          >
            Expenses
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
              Expense categories
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              {report.totals.categoryCount} categories
            </h3>
          </div>
          <span className="text-sm text-muted-foreground">
            Sorted by expense amount
          </span>
        </div>

        {report.rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">No expenses in range</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Record active expenses or widen the report date range.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-h-[640px] overflow-y-auto overflow-x-hidden">
            <table className="responsive-data-table w-full border-collapse text-left text-sm">
              <thead className="text-[11px] text-[#94a3b8]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 text-right font-semibold">Records</th>
                  <th className="px-5 py-3 text-right font-semibold">Total</th>
                  <th className="px-5 py-3 text-right font-semibold">Share</th>
                  <th className="px-5 py-3 text-right font-semibold">Average</th>
                  <th className="px-5 py-3 font-semibold">Top vendor</th>
                  <th className="px-5 py-3 font-semibold">Top method</th>
                  <th className="px-5 py-3 font-semibold">Last expense</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.rows.map((row) => (
                  <tr className="transition hover:bg-[#e6f1fb]/40" key={row.category}>
                    <td className="px-5 py-4 font-semibold" data-label="Category">{row.category}</td>
                    <td className="px-5 py-4 text-right" data-label="Records">
                      {row.expenseCount}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold" data-label="Total">
                      {money.format(row.totalAmount)}
                    </td>
                    <td className="px-5 py-4 text-right" data-label="Share">
                      {row.percentOfExpenses.toFixed(2)}%
                    </td>
                    <td className="px-5 py-4 text-right text-muted-foreground" data-label="Average">
                      {money.format(row.averageExpenseAmount)}
                    </td>
                    <td className="px-5 py-4" data-label="Top vendor">
                      <div>{row.topVendor ?? "No vendor"}</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {money.format(row.topVendorAmount)}
                      </p>
                    </td>
                    <td className="px-5 py-4" data-label="Top method">
                      <div>{row.topPaymentMethod ?? "Not set"}</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {money.format(row.topPaymentMethodAmount)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground" data-label="Last expense">
                      {row.lastExpenseDate
                        ? dates.format(row.lastExpenseDate)
                        : "No expense"}
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
