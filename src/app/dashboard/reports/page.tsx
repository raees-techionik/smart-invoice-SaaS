import { Prisma } from "@prisma/client";
import Link from "next/link";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

type ReportsPageProps = {
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

function dateFormatter(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    from,
    to,
  };
}

function parseDate(value: string | undefined, fallback: Date, endOfDay = false) {
  if (!value) {
    return fallback;
  }

  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(`${value}${suffix}`);

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
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

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user = await requireUser();
  const money = currencyFormatter(user.business.currency);
  const params = await searchParams;
  const defaults = defaultDateRange();
  const fromDate = parseDate(params.from, defaults.from);
  const toDate = parseDate(params.to, defaults.to, true);
  const fromInput = params.from ?? dateInputValue(defaults.from);
  const toInput = params.to ?? dateInputValue(defaults.to);
  const xlsxHref = `/dashboard/reports/xlsx?${new URLSearchParams({
    from: fromInput,
    to: toInput,
  })}`;
  const invoiceWhere: Prisma.InvoiceWhereInput = {
    businessId: user.businessId,
    invoiceDate: {
      gte: fromDate,
      lte: toDate,
    },
    status: "finalized",
  };
  const expenseWhere: Prisma.ExpenseWhereInput = {
    businessId: user.businessId,
    date: {
      gte: fromDate,
      lte: toDate,
    },
    status: "active",
  };
  const refundWhere: Prisma.RefundWhereInput = {
    businessId: user.businessId,
    refundDate: {
      gte: fromDate,
      lte: toDate,
    },
    status: "completed",
  };

  const [
    revenueAggregate,
    refundAggregate,
    expenseAggregate,
    invoiceCount,
    refundCount,
    expenseCount,
    openBalanceAggregate,
    categoryBreakdown,
    recentInvoices,
    recentExpenses,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: {
        grandTotal: true,
      },
      where: invoiceWhere,
    }),
    prisma.refund.aggregate({
      _sum: {
        amount: true,
      },
      where: refundWhere,
    }),
    prisma.expense.aggregate({
      _sum: {
        amount: true,
      },
      where: expenseWhere,
    }),
    prisma.invoice.count({
      where: invoiceWhere,
    }),
    prisma.refund.count({
      where: refundWhere,
    }),
    prisma.expense.count({
      where: expenseWhere,
    }),
    prisma.invoice.aggregate({
      _sum: {
        balanceAmount: true,
      },
      where: invoiceWhere,
    }),
    prisma.expense.groupBy({
      _sum: {
        amount: true,
      },
      by: ["category"],
      orderBy: {
        _sum: {
          amount: "desc",
        },
      },
      where: expenseWhere,
    }),
    prisma.invoice.findMany({
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        invoiceDate: "desc",
      },
      take: 8,
      where: invoiceWhere,
    }),
    prisma.expense.findMany({
      orderBy: {
        date: "desc",
      },
      take: 8,
      where: expenseWhere,
    }),
  ]);

  const grossRevenue = Number(revenueAggregate._sum.grandTotal ?? 0);
  const refunds = Number(refundAggregate._sum.amount ?? 0);
  const netRevenue = grossRevenue - refunds;
  const expenses = Number(expenseAggregate._sum.amount ?? 0);
  const profit = netRevenue - expenses;
  const margin = netRevenue > 0 ? Math.round((profit / netRevenue) * 100) : 0;
  const openBalance = Number(openBalanceAggregate._sum.balanceAmount ?? 0);
  const maxCategoryAmount = Math.max(
    ...categoryBreakdown.map((category) => Number(category._sum.amount ?? 0)),
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
            Profit and loss
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Compare finalized invoice revenue minus completed refunds against
            active operating expenses by date range.
          </p>
        </div>
        <form
          action="/dashboard/reports"
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
        >
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={fromInput}
            name="from"
            type="date"
          />
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={toInput}
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
            href="/dashboard/reports"
          >
            Reset
          </Link>
        </form>
      </header>

      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold">Need deeper visibility?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open receivables for unpaid balances or refunds for return impact
            by method, product, and customer.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
            href="/dashboard/reports/receivables"
          >
            Receivables aging
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/reports/refunds"
          >
            Refund summary
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          helper={`${invoiceCount} finalized invoices`}
          label="Gross revenue"
          tone="good"
          value={money.format(grossRevenue)}
        />
        <MetricCard
          helper={`${refundCount} completed refunds`}
          label="Refunds"
          tone="warn"
          value={money.format(refunds)}
        />
        <MetricCard
          helper="Gross revenue minus refunds"
          label="Net revenue"
          tone="good"
          value={money.format(netRevenue)}
        />
        <MetricCard
          helper={`${expenseCount} active expense records`}
          label="Expenses"
          tone="warn"
          value={money.format(expenses)}
        />
        <MetricCard
          helper={`${margin}% margin for selected range`}
          label="Estimated profit"
          tone={profit >= 0 ? "good" : "warn"}
          value={money.format(profit)}
        />
        <MetricCard
          helper="Uncollected finalized invoice balance"
          label="Receivables"
          value={money.format(openBalance)}
        />
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Expense categories
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Cost breakdown
              </h3>
            </div>
            <span className="text-sm text-muted-foreground">
              {categoryBreakdown.length} categories
            </span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="grid min-h-56 place-items-center p-8 text-center">
              <div>
                <p className="text-lg font-semibold">No expenses in range</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Add expenses or widen the report date range.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 p-5">
              {categoryBreakdown.map((category) => {
                const amount = Number(category._sum.amount ?? 0);

                return (
                  <div className="grid gap-2" key={category.category}>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-semibold">{category.category}</span>
                      <span className="text-muted-foreground">
                        {money.format(amount)} / {percent(amount, expenses)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${percent(amount, maxCategoryAmount)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[14px] border border-border bg-white p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Report formula
          </p>
          <h3 className="mt-1 text-[13px] font-medium">How profit is calculated</h3>
          <dl className="mt-5 grid gap-4 text-sm">
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">
                Finalized invoice revenue
              </dt>
              <dd className="font-semibold">{money.format(grossRevenue)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">
                Completed refunds
              </dt>
              <dd className="font-semibold">-{money.format(refunds)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">Net revenue</dt>
              <dd className="font-semibold">{money.format(netRevenue)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">
                Active operating expenses
              </dt>
              <dd className="font-semibold">{money.format(expenses)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-lg">
              <dt className="font-semibold">Estimated profit</dt>
              <dd className="font-semibold">{money.format(profit)}</dd>
            </div>
          </dl>
          <p className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-6 text-muted-foreground">
            Archived expenses are excluded. Draft invoices are excluded. Refunds
            are subtracted from revenue by refund date. This is a practical
            operating P/L, not a tax filing report yet.
          </p>
        </div>
      </section>

      <section className="grid gap-3.5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h3 className="text-[13px] font-medium">Revenue detail</h3>
            <Link
              className="text-sm font-semibold text-accent"
              href="/dashboard/invoices"
            >
              View invoices
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="grid min-h-48 place-items-center p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No finalized invoices in this date range.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead className="text-[11px] text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Invoice</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentInvoices.map((invoice) => (
                    <tr
                      className="transition hover:bg-[#e6f1fb]/40"
                      key={invoice.id}
                    >
                      <td className="px-5 py-4">
                        <Link
                          className="font-semibold text-accent hover:underline"
                          href={`/dashboard/invoices/${invoice.id}`}
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        {invoice.customer?.name ?? "No customer"}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {dateFormatter(invoice.invoiceDate)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold">
                        {money.format(Number(invoice.grandTotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h3 className="text-[13px] font-medium">Expense detail</h3>
            <Link
              className="text-sm font-semibold text-accent"
              href="/dashboard/expenses"
            >
              View expenses
            </Link>
          </div>
          {recentExpenses.length === 0 ? (
            <div className="grid min-h-48 place-items-center p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No active expenses in this date range.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead className="text-[11px] text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Vendor</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentExpenses.map((expense) => (
                    <tr
                      className="transition hover:bg-[#e6f1fb]/40"
                      key={expense.id}
                    >
                      <td className="px-5 py-4">
                        <Link
                          className="font-semibold text-accent hover:underline"
                          href={`/dashboard/expenses/${expense.id}`}
                        >
                          {expense.category}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        {expense.vendor || "No vendor"}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {dateFormatter(expense.date)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold">
                        {money.format(Number(expense.amount))}
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
