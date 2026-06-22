import { Prisma } from "@prisma/client";
import Link from "next/link";

import { requireReportViewer } from "@/app/_backend/lib/auth/roles";
import { prisma } from "@/app/_backend/lib/db/prisma";

type RefundsReportPageProps = {
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

function decimalText(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function methodLabel(value: string) {
  return value.replace(/_/g, " ");
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

export default async function RefundsReportPage({
  searchParams,
}: RefundsReportPageProps) {
  const user = await requireReportViewer();
  const money = currencyFormatter(user.business.currency);
  const params = await searchParams;
  const defaults = defaultDateRange();
  const fromDate = parseDate(params.from, defaults.from);
  const toDate = parseDate(params.to, defaults.to, true);
  const fromInput = params.from ?? dateInputValue(defaults.from);
  const toInput = params.to ?? dateInputValue(defaults.to);
  const xlsxHref = `/dashboard/reports/refunds/xlsx?${new URLSearchParams({
    from: fromInput,
    to: toInput,
  })}`;
  const refundWhere: Prisma.RefundWhereInput = {
    businessId: user.businessId,
    refundDate: {
      gte: fromDate,
      lte: toDate,
    },
    status: "completed",
  };

  const refunds = await prisma.refund.findMany({
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
      invoice: {
        select: {
          id: true,
          invoiceDate: true,
          invoiceNumber: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      refundDate: "desc",
    },
    where: refundWhere,
  });

  const totalRefunded = refunds.reduce(
    (total, refund) => total + Number(refund.amount),
    0,
  );
  const totalRestocked = refunds.reduce(
    (total, refund) =>
      total +
      refund.items.reduce(
        (itemTotal, item) => itemTotal + Number(item.restockQuantity),
        0,
      ),
    0,
  );
  const totalReturnedQuantity = refunds.reduce(
    (total, refund) =>
      total +
      refund.items.reduce(
        (itemTotal, item) => itemTotal + Number(item.quantity),
        0,
      ),
    0,
  );
  const methodRows = Array.from(
    refunds
      .reduce((methodMap, refund) => {
        const existing = methodMap.get(refund.refundMethod) ?? {
          amount: 0,
          count: 0,
          method: refund.refundMethod,
        };

        existing.amount += Number(refund.amount);
        existing.count += 1;
        methodMap.set(refund.refundMethod, existing);

        return methodMap;
      }, new Map<string, { amount: number; count: number; method: string }>())
      .values(),
  ).sort((left, right) => right.amount - left.amount);
  const productRows = Array.from(
    refunds
      .flatMap((refund) => refund.items)
      .reduce((productMap, item) => {
        const key = item.product?.id ?? item.itemName;
        const existing = productMap.get(key) ?? {
          amount: 0,
          count: 0,
          name: item.product?.name ?? item.itemName,
          quantity: 0,
          restocked: 0,
          sku: item.product?.sku ?? "",
          unit: item.product?.unit ?? "units",
        };

        existing.amount += Number(item.refundAmount);
        existing.count += 1;
        existing.quantity += Number(item.quantity);
        existing.restocked += Number(item.restockQuantity);
        productMap.set(key, existing);

        return productMap;
      }, new Map<string, {
        amount: number;
        count: number;
        name: string;
        quantity: number;
        restocked: number;
        sku: string;
        unit: string;
      }>())
      .values(),
  ).sort((left, right) => right.amount - left.amount);
  const customerRows = Array.from(
    refunds
      .reduce((customerMap, refund) => {
        const key = refund.customer?.id ?? "walk-in";
        const existing = customerMap.get(key) ?? {
          amount: 0,
          businessName: refund.customer?.businessName ?? "",
          count: 0,
          customerId: refund.customer?.id ?? "",
          email: refund.customer?.email ?? "",
          name: refund.customer?.name ?? "Walk-in/No customer",
          phone: refund.customer?.phone ?? "",
        };

        existing.amount += Number(refund.amount);
        existing.count += 1;
        customerMap.set(key, existing);

        return customerMap;
      }, new Map<string, {
        amount: number;
        businessName: string;
        count: number;
        customerId: string;
        email: string;
        name: string;
        phone: string;
      }>())
      .values(),
  ).sort((left, right) => right.amount - left.amount);
  const maxMethodAmount = Math.max(
    ...methodRows.map((method) => method.amount),
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
            Refund summary
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Review completed refunds by date range, method, product, and
            customer so net revenue stays explainable.
          </p>
        </div>
        <form
          action="/dashboard/reports/refunds"
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
            href="/dashboard/reports/refunds"
          >
            Reset
          </Link>
        </form>
      </header>

      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold">Refunds feed net revenue</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The main P/L report subtracts these completed refunds by refund
            date from finalized invoice revenue.
          </p>
        </div>
        <Link
          className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
          href={`/dashboard/reports?from=${fromInput}&to=${toInput}`}
        >
          Back to P/L
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          helper={`${refunds.length} completed refund records`}
          label="Refunded amount"
          tone="danger"
          value={money.format(totalRefunded)}
        />
        <MetricCard
          helper="Returned invoice line quantity"
          label="Returned units"
          value={decimalText(totalReturnedQuantity)}
        />
        <MetricCard
          helper="Product quantity restored to stock"
          label="Restocked units"
          value={decimalText(totalRestocked)}
        />
        <MetricCard
          helper="Customers with refunds in range"
          label="Affected customers"
          value={String(customerRows.length)}
        />
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="border-b border-border p-5">
            <p className="text-sm font-medium text-muted-foreground">
              Refund methods
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Method breakdown</h3>
          </div>
          {methodRows.length === 0 ? (
            <div className="grid min-h-48 place-items-center p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No refunds in this date range.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 p-5">
              {methodRows.map((method) => (
                <div className="grid gap-2" key={method.method}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold capitalize">
                      {methodLabel(method.method)}
                    </span>
                    <span className="text-muted-foreground">
                      {money.format(method.amount)} /{" "}
                      {percent(method.amount, totalRefunded)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${percent(method.amount, maxMethodAmount)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {method.count} refund records
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Product impact
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Refunds by product/service
              </h3>
            </div>
            <span className="text-sm text-muted-foreground">
              {productRows.length} items
            </span>
          </div>
          {productRows.length === 0 ? (
            <div className="grid min-h-48 place-items-center p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No returned products or refunded services in this range.
              </p>
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
              <table className="responsive-data-table w-full border-collapse text-left text-sm">
                <thead className="text-[11px] text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Item</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Quantity
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Restocked
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Refunds
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productRows.map((product) => (
                    <tr
                      className="transition hover:bg-[#e6f1fb]/40"
                      key={`${product.name}-${product.sku}`}
                    >
                      <td className="px-5 py-4 align-top" data-label="Item">
                        <p className="font-semibold">{product.name}</p>
                        <p className="mt-1 text-muted-foreground">
                          {product.sku || "No SKU"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right align-top" data-label="Quantity">
                        {decimalText(product.quantity)} {product.unit}
                      </td>
                      <td className="px-5 py-4 text-right align-top" data-label="Restocked">
                        {decimalText(product.restocked)} {product.unit}
                      </td>
                      <td className="px-5 py-4 text-right align-top" data-label="Refunds">
                        {product.count}
                      </td>
                      <td className="px-5 py-4 text-right align-top font-semibold" data-label="Amount">
                        {money.format(product.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Customer impact
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Refunds by customer
              </h3>
            </div>
            <span className="text-sm text-muted-foreground">
              {customerRows.length} customers
            </span>
          </div>
          {customerRows.length === 0 ? (
            <div className="grid min-h-48 place-items-center p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No customer refunds in this date range.
              </p>
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
              <table className="responsive-data-table w-full border-collapse text-left text-sm">
                <thead className="text-[11px] text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Refunds
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customerRows.map((customer) => (
                    <tr
                      className="transition hover:bg-[#e6f1fb]/40"
                      key={customer.customerId || customer.name}
                    >
                      <td className="px-5 py-4 align-top" data-label="Customer">
                        {customer.customerId ? (
                          <Link
                            className="font-semibold text-accent hover:underline"
                            href={`/dashboard/customers/${customer.customerId}`}
                          >
                            {customer.name}
                          </Link>
                        ) : (
                          <p className="font-semibold">{customer.name}</p>
                        )}
                        <p className="mt-1 text-muted-foreground">
                          {customer.businessName ||
                            customer.email ||
                            customer.phone ||
                            "No contact details"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right align-top" data-label="Refunds">
                        {customer.count}
                      </td>
                      <td className="px-5 py-4 text-right align-top font-semibold" data-label="Amount">
                        {money.format(customer.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Refund detail
              </p>
              <h3 className="mt-1 text-[13px] font-medium">Recent refunds</h3>
            </div>
            <span className="text-sm text-muted-foreground">
              {refunds.length} records
            </span>
          </div>
          {refunds.length === 0 ? (
            <div className="grid min-h-48 place-items-center p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No completed refunds in this date range.
              </p>
            </div>
          ) : (
            <div className="max-h-[640px] overflow-y-auto overflow-x-hidden">
              <table className="responsive-data-table w-full border-collapse text-left text-sm">
                <thead className="text-[11px] text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Refund</th>
                    <th className="px-5 py-3 font-semibold">Invoice</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Method</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {refunds.map((refund) => (
                    <tr
                      className="transition hover:bg-[#e6f1fb]/40"
                      key={refund.id}
                    >
                      <td className="px-5 py-4 align-top" data-label="Refund">
                        <p className="font-semibold">{refund.refundNumber}</p>
                        <p className="mt-1 text-muted-foreground">
                          {dateFormatter(refund.refundDate)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {refund.reason || refund.notes || refund.status}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top" data-label="Invoice">
                        <Link
                          className="font-semibold text-accent hover:underline"
                          href={`/dashboard/invoices/${refund.invoice.id}`}
                        >
                          {refund.invoice.invoiceNumber}
                        </Link>
                        <p className="mt-1 text-muted-foreground">
                          {dateFormatter(refund.invoice.invoiceDate)}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top" data-label="Customer">
                        {refund.customer?.name ?? "No customer"}
                      </td>
                      <td className="px-5 py-4 align-top capitalize" data-label="Method">
                        {methodLabel(refund.refundMethod)}
                      </td>
                      <td className="px-5 py-4 text-right align-top font-semibold" data-label="Amount">
                        {money.format(Number(refund.amount))}
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
