import { Prisma } from "@prisma/client";
import Link from "next/link";

import { ExpenseForm } from "@/app/_frontend/components/dashboard/expense-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { AppIcon, metricIconForLabel } from "@/app/_frontend/components/dashboard/app-icons";


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
          ? "bg-[#ecfdf5] text-[#047857]"
          : "bg-[#eef2ff] text-[#4f46e5]"
      }`}
    >
      {status}
    </span>
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
  tone: "amber" | "blue" | "green";
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
    <div className="premium-card premium-card-hover relative overflow-hidden rounded-[16px] border p-[15px]">
      <div
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${toneLineClasses[tone]}`}
      />
      <div
        className={`premium-stat-icon mb-3 grid size-7 place-items-center rounded-lg text-[10.5px] font-semibold ${toneClasses[tone]}`}
      >
        <AppIcon className="size-4" name={metricIconForLabel(label)} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-[21px] font-medium leading-none">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
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
        <div className="premium-visual-coin"><AppIcon className="size-5" name="expense" /></div>
      </div>
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
    <div className="relative grid gap-3.5">
      <PremiumVisual />
      <header className="premium-card relative z-[1] flex flex-col gap-4 overflow-hidden rounded-[16px] border p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#635bff]">
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
                ? "premium-button border-transparent text-white hover:brightness-105"
                : "premium-soft-button hover:border-[#635bff]/30 hover:bg-white"
            }`}
            href="/dashboard/expenses"
          >
            Active
          </Link>
          <Link
            className={`inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition ${
              selectedStatus === "archived"
                ? "premium-button border-transparent text-white hover:brightness-105"
                : "premium-soft-button hover:border-[#635bff]/30 hover:bg-white"
            }`}
            href="/dashboard/expenses?status=archived"
          >
            Archived
          </Link>
        </div>
      </header>

      <section className="relative z-[1] grid gap-4 md:grid-cols-3">
        <MetricCard
          helper="Active expenses included in profit estimates."
          label="Active expense total"
          tone="amber"
          value={money.format(totalActiveExpense)}
        />
        <MetricCard
          helper="Expense records currently counted."
          label="Active records"
          tone="blue"
          value={String(activeCount)}
        />
        <MetricCard
          helper={
            topCategory
              ? `${money.format(Number(topCategory._sum.amount ?? 0))} in ${topCategory.category}`
              : "No categories recorded yet."
          }
          label="Top category"
          tone="green"
          value={topCategory?.category ?? "None"}
        />
      </section>

      <section className="relative z-[1] grid items-start gap-3.5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="premium-card rounded-[16px] border p-4">
          <div className="mb-5">
            <p className="text-sm font-medium text-muted-foreground">
              New expense
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Record cost</h3>
          </div>
          <ExpenseForm />
        </div>

        <div className="grid gap-3.5 content-start">
          <div className="premium-card flex max-h-[560px] flex-col overflow-hidden rounded-[16px] border p-4 md:max-h-[760px]">
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
              <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overflow-x-hidden">
                {categoryTotals.map((category) => (
                  <div
                    className="flex flex-col gap-1 p-4 transition hover:bg-[#635bff]/[0.04] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    key={category.category}
                  >
                    <span className="min-w-0 break-words font-semibold">{category.category}</span>
                    <span className="shrink-0 font-semibold">
                      {money.format(Number(category._sum.amount ?? 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="premium-card overflow-hidden rounded-[16px] border p-4">
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
              <div className="max-h-[560px] overflow-y-auto overflow-x-hidden pr-1">
                <table className="responsive-data-table w-full border-collapse text-left text-sm">
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
                        className="transition hover:bg-[#635bff]/[0.04]"
                        key={expense.id}
                      >
                        <td className="px-5 py-4 align-top" data-label="Expense">
                          <Link
                            className="break-words font-semibold text-accent hover:underline"
                            href={`/dashboard/expenses/${expense.id}`}
                          >
                            {expense.category}
                          </Link>
                          <p className="mt-1 text-muted-foreground">
                            {dateFormatter(expense.date)}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top" data-label="Vendor">
                          {expense.vendor || "No vendor"}
                          <p className="mt-1 text-muted-foreground">
                            {expense.notes || "No notes"}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top capitalize" data-label="Method">
                          {(expense.paymentMethod || "not set").replaceAll(
                            "_",
                            " ",
                          )}
                        </td>
                        <td className="px-5 py-4 align-top" data-label="Receipt">
                          {expense.attachmentPath ? (
                            <Link
                              className="break-words font-semibold text-accent hover:underline"
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
                        <td className="px-5 py-4 align-top" data-label="Owner">
                          {expense.createdBy?.name ?? "System"}
                        </td>
                        <td className="px-5 py-4 align-top" data-label="Status">
                          <StatusBadge status={expense.status} />
                        </td>
                        <td className="px-5 py-4 text-right align-top font-semibold" data-label="Amount">
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
