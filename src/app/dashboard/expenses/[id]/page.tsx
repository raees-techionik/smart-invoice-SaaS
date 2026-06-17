import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveExpense } from "@/app/dashboard/expenses/actions";
import { ExpenseForm } from "@/app/_frontend/components/dashboard/expense-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

type ExpenseDetailPageProps = {
  params: Promise<{
    id: string;
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

function decimalInputValue(value: unknown) {
  return Number(value).toFixed(2);
}

function receiptFileName(storedPath: string | null) {
  return storedPath?.split("/").pop() ?? "Receipt file";
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

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

export default async function ExpenseDetailPage({
  params,
}: ExpenseDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const money = currencyFormatter(user.business.currency);

  const expense = await prisma.expense.findFirst({
    include: {
      createdBy: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    where: {
      businessId: user.businessId,
      id,
    },
  });

  if (!expense) {
    notFound();
  }

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Expense
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            {expense.category}
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Edit expense details, review payment metadata, or archive costs that
            should no longer count toward operating totals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/expenses"
          >
            Back to expenses
          </Link>
          {expense.status !== "archived" ? (
            <form action={archiveExpense}>
              <input name="expenseId" type="hidden" value={expense.id} />
              <button
                className="inline-flex h-[34px] items-center justify-center rounded-lg border border-[#e24b4a]/30 bg-white px-3 text-[11.5px] font-medium text-[#a32d2d] transition hover:bg-[#fcebeb]"
                type="submit"
              >
                Archive expense
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[14px] border border-border bg-white p-[15px]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Status
          </p>
          <div className="mt-3">
            <StatusBadge status={expense.status} />
          </div>
        </div>
        <div className="rounded-[14px] border border-border bg-white p-[15px]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Amount
          </p>
          <p className="mt-3 text-2xl font-semibold">
            {money.format(Number(expense.amount))}
          </p>
        </div>
        <div className="rounded-[14px] border border-border bg-white p-[15px]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Date
          </p>
          <p className="mt-3 text-2xl font-semibold">
            {dateFormatter(expense.date)}
          </p>
        </div>
        <div className="rounded-[14px] border border-border bg-white p-[15px]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Method
          </p>
          <p className="mt-3 text-2xl font-semibold capitalize">
            {(expense.paymentMethod || "not set").replaceAll("_", " ")}
          </p>
        </div>
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[14px] border border-border bg-white p-4">
          <div className="mb-5">
            <p className="text-sm font-medium text-muted-foreground">
              Edit expense
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Cost details</h3>
          </div>
          <ExpenseForm
            defaults={{
              amount: decimalInputValue(expense.amount),
              attachmentPath: expense.attachmentPath,
              category: expense.category,
              date: dateInputValue(expense.date),
              notes: expense.notes ?? "",
              paymentMethod: expense.paymentMethod ?? "cash",
              vendor: expense.vendor ?? "",
            }}
            expenseId={expense.id}
            submitLabel="Update expense"
          />
        </div>

        <div className="grid gap-3.5 content-start">
          <div className="rounded-[14px] border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Expense metadata
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <DetailRow
                label="Vendor"
                value={expense.vendor || "No vendor"}
              />
              <DetailRow
                label="Recorded by"
                value={expense.createdBy?.name ?? "System"}
              />
              <DetailRow
                label="Recorder email"
                value={expense.createdBy?.email ?? "Not available"}
              />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Attachment</dt>
                <dd className="text-right font-semibold">
                  {expense.attachmentPath ? "Receipt attached" : "Not attached"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[14px] border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Receipt attachment
            </p>
            {expense.attachmentPath ? (
              <div className="mt-3 grid gap-4">
                <div className="rounded-[10px] border border-border bg-[#f8f9fa] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Stored file
                  </p>
                  <p className="mt-2 break-all text-sm font-semibold">
                    {receiptFileName(expense.attachmentPath)}
                  </p>
                </div>
                <Link
                  className="inline-flex h-[34px] w-fit items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
                  href={`/dashboard/expenses/${expense.id}/receipt`}
                  target="_blank"
                >
                  View receipt
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                No receipt is attached yet. Upload a receipt from the edit form
                and it will appear here and in the expense history table.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
