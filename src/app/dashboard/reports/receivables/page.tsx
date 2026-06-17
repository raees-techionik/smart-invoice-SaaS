import Link from "next/link";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

type ReceivablesReportPageProps = {
  searchParams: Promise<{
    asOf?: string;
  }>;
};

type AgingBucket = "current" | "days1to30" | "days31to60" | "days61to90" | "days90plus";

const agingBucketLabels: Record<AgingBucket, string> = {
  current: "Current",
  days1to30: "1-30",
  days31to60: "31-60",
  days61to90: "61-90",
  days90plus: "90+",
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

function parseAsOfDate(value: string | undefined) {
  if (!value) {
    return new Date();
  }

  const date = new Date(`${value}T23:59:59.999`);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function daysBetween(later: Date, earlier: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const laterDay = Date.UTC(
    later.getFullYear(),
    later.getMonth(),
    later.getDate(),
  );
  const earlierDay = Date.UTC(
    earlier.getFullYear(),
    earlier.getMonth(),
    earlier.getDate(),
  );

  return Math.floor((laterDay - earlierDay) / millisecondsPerDay);
}

function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) {
    return "current";
  }

  if (daysOverdue <= 30) {
    return "days1to30";
  }

  if (daysOverdue <= 60) {
    return "days31to60";
  }

  if (daysOverdue <= 90) {
    return "days61to90";
  }

  return "days90plus";
}

function emptyBuckets() {
  return {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
  } satisfies Record<AgingBucket, number>;
}

function MetricCard({
  helper,
  label,
  tone = "neutral",
  value,
}: {
  helper: string;
  label: string;
  tone?: "danger" | "neutral" | "warn";
  value: string;
}) {
  const toneClass =
    tone === "danger"
      ? "text-danger"
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

function BucketBadge({ daysOverdue }: { daysOverdue: number }) {
  const bucket = agingBucket(daysOverdue);
  const toneClass =
    bucket === "current"
      ? "bg-[#eaf3de] text-[#3b6d11]"
      : bucket === "days90plus"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-800";

  return (
    <span className={`inline-flex rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium ${toneClass}`}>
      {agingBucketLabels[bucket]}
    </span>
  );
}

export default async function ReceivablesReportPage({
  searchParams,
}: ReceivablesReportPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const asOfDate = parseAsOfDate(params.asOf);
  const money = currencyFormatter(user.business.currency);
  const asOfInput = dateInputValue(asOfDate);
  const xlsxHref = `/dashboard/reports/receivables/xlsx?${new URLSearchParams({
    asOf: asOfInput,
  })}`;

  const invoices = await prisma.invoice.findMany({
    include: {
      customer: {
        select: {
          businessName: true,
          email: true,
          id: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: [
      {
        dueDate: "asc",
      },
      {
        invoiceDate: "asc",
      },
    ],
    where: {
      balanceAmount: {
        gt: 0,
      },
      businessId: user.businessId,
      invoiceDate: {
        lte: asOfDate,
      },
      status: "finalized",
    },
  });

  const invoiceRows = invoices.map((invoice) => {
    const dueDate = invoice.dueDate ?? invoice.invoiceDate;
    const daysOverdue = daysBetween(asOfDate, dueDate);
    const bucket = agingBucket(daysOverdue);
    const balance = Number(invoice.balanceAmount);

    return {
      balance,
      bucket,
      customer: invoice.customer,
      daysOverdue,
      dueDate,
      invoice,
    };
  });
  const totals = invoiceRows.reduce(
    (currentTotals, row) => {
      currentTotals.total += row.balance;
      currentTotals.buckets[row.bucket] += row.balance;

      if (row.daysOverdue > 0) {
        currentTotals.overdue += row.balance;
      }

      return currentTotals;
    },
    {
      buckets: emptyBuckets(),
      overdue: 0,
      total: 0,
    },
  );
  const customerStatements = Array.from(
    invoiceRows
      .reduce(
        (statementMap, row) => {
          const customerKey = row.customer?.id ?? "no-customer";
          const existing = statementMap.get(customerKey) ?? {
            buckets: emptyBuckets(),
            businessName: row.customer?.businessName ?? "",
            customerId: row.customer?.id ?? "",
            email: row.customer?.email ?? "",
            invoiceCount: 0,
            name: row.customer?.name ?? "No customer",
            oldestDays: 0,
            phone: row.customer?.phone ?? "",
            total: 0,
          };

          existing.invoiceCount += 1;
          existing.total += row.balance;
          existing.buckets[row.bucket] += row.balance;
          existing.oldestDays = Math.max(existing.oldestDays, row.daysOverdue);
          statementMap.set(customerKey, existing);

          return statementMap;
        },
        new Map<
          string,
          {
            buckets: Record<AgingBucket, number>;
            businessName: string;
            customerId: string;
            email: string;
            invoiceCount: number;
            name: string;
            oldestDays: number;
            phone: string;
            total: number;
          }
        >(),
      )
      .values(),
  ).sort((left, right) => right.total - left.total);

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Reports
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Receivables aging
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            See which customers owe money, how old balances are, and which
            invoices need collection follow-up.
          </p>
        </div>
        <form
          action="/dashboard/reports/receivables"
          className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
        >
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={asOfInput}
            name="asOf"
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
            P/L report
          </Link>
        </form>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          helper={`${invoiceRows.length} unpaid finalized invoices`}
          label="Total receivable"
          tone="warn"
          value={money.format(totals.total)}
        />
        <MetricCard
          helper="Balance past due date"
          label="Overdue"
          tone={totals.overdue > 0 ? "danger" : "neutral"}
          value={money.format(totals.overdue)}
        />
        <MetricCard
          helper="Customers with open balances"
          label="Customer statements"
          value={String(customerStatements.length)}
        />
        <MetricCard
          helper={`As of ${dateFormatter(asOfDate)}`}
          label="90+ days"
          tone={totals.buckets.days90plus > 0 ? "danger" : "neutral"}
          value={money.format(totals.buckets.days90plus)}
        />
      </section>

      <section className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
        <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Aging buckets
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Open balance by age</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            Due date based, invoice date fallback
          </span>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-5">
          {(Object.keys(agingBucketLabels) as AgingBucket[]).map((bucket) => (
            <div
              className="rounded-[10px] border border-border bg-[#f8f9fa] p-3"
              key={bucket}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {agingBucketLabels[bucket]}
              </p>
              <p className="mt-3 text-2xl font-semibold">
                {money.format(totals.buckets[bucket])}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
        <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Customer statements
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Who owes money</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {customerStatements.length} customer records
          </span>
        </div>

        {customerStatements.length === 0 ? (
          <div className="grid min-h-48 place-items-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">No receivables</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Finalized unpaid invoices will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="text-[11px] text-[#94a3b8]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Total
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Current
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    1-30
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    31-60
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    61-90
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">90+</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Invoices
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customerStatements.map((statement) => (
                  <tr
                    className="transition hover:bg-[#e6f1fb]/40"
                    key={statement.customerId || statement.name}
                  >
                    <td className="px-5 py-4 align-top">
                      {statement.customerId ? (
                        <Link
                          className="font-semibold text-accent hover:underline"
                          href={`/dashboard/customers/${statement.customerId}`}
                        >
                          {statement.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">{statement.name}</span>
                      )}
                      <p className="mt-1 text-muted-foreground">
                        {statement.businessName ||
                          statement.email ||
                          statement.phone ||
                          "No contact details"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        Oldest {Math.max(statement.oldestDays, 0)} days
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right align-top font-semibold">
                      {money.format(statement.total)}
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      {money.format(statement.buckets.current)}
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      {money.format(statement.buckets.days1to30)}
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      {money.format(statement.buckets.days31to60)}
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      {money.format(statement.buckets.days61to90)}
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      {money.format(statement.buckets.days90plus)}
                    </td>
                    <td className="px-5 py-4 text-right align-top text-muted-foreground">
                      {statement.invoiceCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
        <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Invoice detail
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Aging detail</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {invoiceRows.length} open invoices
          </span>
        </div>

        {invoiceRows.length === 0 ? (
          <div className="grid min-h-48 place-items-center p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No unpaid finalized invoices as of this date.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="text-[11px] text-[#94a3b8]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Invoice</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Due date</th>
                  <th className="px-5 py-3 font-semibold">Age</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Total
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Paid
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoiceRows.map((row) => (
                  <tr
                    className="transition hover:bg-[#e6f1fb]/40"
                    key={row.invoice.id}
                  >
                    <td className="px-5 py-4 align-top">
                      <Link
                        className="font-semibold text-accent hover:underline"
                        href={`/dashboard/invoices/${row.invoice.id}`}
                      >
                        {row.invoice.invoiceNumber}
                      </Link>
                      <p className="mt-1 text-muted-foreground">
                        {dateFormatter(row.invoice.invoiceDate)}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      {row.customer?.name ?? "No customer"}
                      <p className="mt-1 text-muted-foreground">
                        {row.customer?.businessName ?? "Individual"}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top text-muted-foreground">
                      {dateFormatter(row.dueDate)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <BucketBadge daysOverdue={row.daysOverdue} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.daysOverdue > 0
                          ? `${row.daysOverdue} days overdue`
                          : "Not due yet"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      {money.format(Number(row.invoice.grandTotal))}
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      {money.format(Number(row.invoice.paidAmount))}
                    </td>
                    <td className="px-5 py-4 text-right align-top font-semibold">
                      {money.format(row.balance)}
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
