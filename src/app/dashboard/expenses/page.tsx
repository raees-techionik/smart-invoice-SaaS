import { Prisma } from "@prisma/client";
import Link from "next/link";

import { ExpenseForm } from "@/app/_frontend/components/dashboard/expense-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

type ExpensesPageProps = {
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

function dateFormatter(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";

  return (
    <span
      className={`inline-flex rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium capitalize ${
        active
          ? "bg-[#eaf3de] text-[#3b6d11]"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

function MetricCard({
  helper,
  label,
  value,
}: {
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-white p-[15px]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-[21px] font-medium leading-none">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

export default async function ExpensesPage({
  searchParams,
}: ExpensesPageProps) {
  const user = await requireUser();
  const { status } = await searchParams;
  const selectedStatus = status === "archived" ? "archived" : "active";
  const money = currencyFormatter(user.business.currency);
  const where: Prisma.ExpenseWhereInput = {
    businessId: user.businessId,
    status: selectedStatus,
  };

  const [
    expenses,
    activeAggregate,
    archivedCount,
    activeCount,
    categoryTotals,
  ] = await Promise.all([
    prisma.expense.findMany({
      include: {
        createdBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      take: 30,
      where,
    }),
    prisma.expense.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        businessId: user.businessId,
        status: "active",
      },
    }),
    prisma.expense.count({
      where: {
        businessId: user.businessId,
        status: "archived",
      },
    }),
    prisma.expense.count({
      where: {
        businessId: user.businessId,
        status: "active",
      },
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
      take: 5,
      where: {
        businessId: user.businessId,
        status: "active",
      },
    }),
  ]);

  const totalActiveExpense = Number(activeAggregate._sum.amount ?? 0);
  const topCategory = categoryTotals[0];

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Expenses
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Operating costs
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Record business costs now so profit/loss reporting has clean expense
            data later.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className={`inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition ${
              selectedStatus === "active"
                ? "border-accent bg-accent text-white"
                : "border-border bg-white hover:bg-[#e6f1fb]"
            }`}
            href="/dashboard/expenses"
          >
            Active
          </Link>
          <Link
            className={`inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition ${
              selectedStatus === "archived"
                ? "border-accent bg-accent text-white"
                : "border-border bg-white hover:bg-[#e6f1fb]"
            }`}
            href="/dashboard/expenses?status=archived"
          >
            Archived
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          helper="Active expenses included in profit estimates."
          label="Active expense total"
          value={money.format(totalActiveExpense)}
        />
        <MetricCard
          helper="Expense records currently counted."
          label="Active records"
          value={String(activeCount)}
        />
        <MetricCard
          helper={
            topCategory
              ? `${money.format(Number(topCategory._sum.amount ?? 0))} in ${topCategory.category}`
              : "No categories recorded yet."
          }
          label="Top category"
          value={topCategory?.category ?? "None"}
        />
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[14px] border border-border bg-white p-4">
          <div className="mb-5">
            <p className="text-sm font-medium text-muted-foreground">
              New expense
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Record cost</h3>
          </div>
          <ExpenseForm />
        </div>

        <div className="grid gap-3.5 content-start">
          <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
            <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Category summary
                </p>
                <h3 className="mt-1 text-[13px] font-medium">
                  Active expenses by category
                </h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {categoryTotals.length} categories
              </span>
            </div>
            {categoryTotals.length === 0 ? (
              <div className="grid min-h-40 place-items-center p-8 text-center">
                <div>
                  <p className="text-lg font-semibold">No expenses yet</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Add operating costs to populate this summary.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {categoryTotals.map((category) => (
                  <div
                    className="flex items-center justify-between gap-4 p-4"
                    key={category.category}
                  >
                    <span className="font-semibold">{category.category}</span>
                    <span className="font-semibold">
                      {money.format(Number(category._sum.amount ?? 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
            <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Expense history
                </p>
                <h3 className="mt-1 text-[13px] font-medium">
                  {selectedStatus === "archived"
                    ? "Archived expenses"
                    : "Recent expenses"}
                </h3>
              </div>
              <span className="text-sm text-muted-foreground">
                Showing {expenses.length} records / {archivedCount} archived
              </span>
            </div>

            {expenses.length === 0 ? (
              <div className="grid min-h-48 place-items-center p-8 text-center">
                <div>
                  <p className="text-lg font-semibold">
                    No {selectedStatus} expenses
                  </p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Expense records will appear here after they are saved.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                  <thead className="text-[11px] text-[#94a3b8]">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Expense</th>
                      <th className="px-5 py-3 font-semibold">Vendor</th>
                      <th className="px-5 py-3 font-semibold">Method</th>
                      <th className="px-5 py-3 font-semibold">Receipt</th>
                      <th className="px-5 py-3 font-semibold">Owner</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {expenses.map((expense) => (
                      <tr
                        className="transition hover:bg-[#e6f1fb]/40"
                        key={expense.id}
                      >
                        <td className="px-5 py-4 align-top">
                          <Link
                            className="font-semibold text-accent hover:underline"
                            href={`/dashboard/expenses/${expense.id}`}
                          >
                            {expense.category}
                          </Link>
                          <p className="mt-1 text-muted-foreground">
                            {dateFormatter(expense.date)}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {expense.vendor || "No vendor"}
                          <p className="mt-1 text-muted-foreground">
                            {expense.notes || "No notes"}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top capitalize">
                          {(expense.paymentMethod || "not set").replaceAll(
                            "_",
                            " ",
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          {expense.attachmentPath ? (
                            <Link
                              className="font-semibold text-accent hover:underline"
                              href={`/dashboard/expenses/${expense.id}/receipt`}
                              target="_blank"
                            >
                              View receipt
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              Not attached
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          {expense.createdBy?.name ?? "System"}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <StatusBadge status={expense.status} />
                        </td>
                        <td className="px-5 py-4 text-right align-top font-semibold">
                          {money.format(Number(expense.amount))}
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
    </div>
  );
}
