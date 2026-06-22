import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { archiveCustomer } from "@/app/dashboard/customers/actions";
import { CommunicationNoteForm } from "@/app/_frontend/components/dashboard/communication-note-form";
import { CommunicationTimeline } from "@/app/_frontend/components/dashboard/communication-timeline";
import { CustomerForm } from "@/app/_frontend/components/dashboard/customer-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { buildCustomerCommunicationTimeline } from "@/app/_backend/lib/communication-timeline";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { AppIcon, metricIconForLabel } from "@/app/_frontend/components/dashboard/app-icons";


type CustomerDetailPageProps = {
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

function decimalInputValue(value: unknown) {
  return Number(value).toFixed(2);
}

function paymentStatus(invoice: {
  balanceAmount: unknown;
  paidAmount: unknown;
  status: string;
}) {
  if (invoice.status === "draft") {
    return "Draft";
  }

  if (Number(invoice.balanceAmount) <= 0) {
    return "Paid";
  }

  if (Number(invoice.paidAmount) > 0) {
    return "Partial";
  }

  return "Unpaid";
}

function MetricCard({
  helper,
  label,
  tone,
  value,
}: {
  helper: string;
  label: string;
  tone: "blue" | "green" | "amber";
  value: string;
}) {
  const toneClasses = {
    amber: "bg-[#faeeda] text-[#854f0b]",
    blue: "bg-[#e6f1fb] text-[#185fa5]",
    green: "bg-[#eaf3de] text-[#3b6d11]",
  };

  return (
    <div className="rounded-[14px] border border-border bg-white p-[15px]">
      <div
        className={`mb-2.5 grid size-8 place-items-center rounded-lg text-[11px] font-semibold ${toneClasses[tone]}`}
      >
        <AppIcon className="size-4" name={metricIconForLabel(label)} />
      </div>
      <p className="font-mono text-[20px] font-medium leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[10.5px] text-[#94a3b8]">{helper}</p>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  const isPositive = ["active", "Paid"].includes(label);

  return (
    <span
      className={`inline-flex rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium capitalize ${
        isPositive
          ? "bg-[#eaf3de] text-[#3b6d11]"
          : "bg-[#faeeda] text-[#854f0b]"
      }`}
    >
      {label}
    </span>
  );
}

function Card({
  children,
  className = "",
  subtitle,
  title,
}: {
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className={`rounded-[14px] border border-border bg-white p-4 ${className}`}>
      <div className="mb-[13px] flex items-center justify-between gap-4">
        <h3 className="text-[13px] font-medium">{title}</h3>
        {subtitle ? (
          <span className="text-[11px] text-[#94a3b8]">{subtitle}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="grid min-h-36 place-items-center text-center">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const money = currencyFormatter(user.business.currency);

  const customer = await prisma.customer.findFirst({
    include: {
      communicationNotes: {
        include: {
          createdBy: {
            select: {
              email: true,
              name: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      invoices: {
        include: {
          _count: {
            select: {
              items: true,
              payments: true,
            },
          },
          emailSends: {
            include: {
              createdBy: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
            orderBy: {
              preparedAt: "desc",
            },
          },
          payments: {
            orderBy: {
              paymentDate: "desc",
            },
          },
          refunds: {
            include: {
              items: true,
            },
            orderBy: {
              refundDate: "desc",
            },
          },
        },
        orderBy: {
          invoiceDate: "desc",
        },
      },
    },
    where: {
      businessId: user.businessId,
      id,
    },
  });

  if (!customer) {
    notFound();
  }

  const totals = customer.invoices.reduce(
    (currentTotals, invoice) => ({
      balance: currentTotals.balance + Number(invoice.balanceAmount),
      billed: currentTotals.billed + Number(invoice.grandTotal),
      paid: currentTotals.paid + Number(invoice.paidAmount),
    }),
    {
      balance: Number(customer.openingBalance),
      billed: 0,
      paid: 0,
    },
  );
  const timelineEntries = buildCustomerCommunicationTimeline(
    customer,
    user.business.currency,
  );

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Customer
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            {customer.name}
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            {customer.businessName || "Individual customer"} -{" "}
            {customer.phone || customer.email || "No contact set"} -{" "}
            {money.format(totals.balance)} balance
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/customers"
          >
            Back
          </Link>
          {customer.status !== "inactive" ? (
            <form action={archiveCustomer}>
              <input name="customerId" type="hidden" value={customer.id} />
              <button
                className="inline-flex h-[34px] items-center justify-center rounded-lg border border-[#e24b4a]/30 bg-white px-3 text-[11.5px] font-medium text-[#a32d2d] transition hover:bg-[#fcebeb]"
                type="submit"
              >
                Archive customer
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <section className="grid gap-[11px] md:grid-cols-4">
        <MetricCard
          helper="Lifecycle state"
          label="Status"
          tone={customer.status === "active" ? "green" : "amber"}
          value={customer.status}
        />
        <MetricCard
          helper="Drafts and finalized invoices"
          label="Invoices"
          tone="blue"
          value={String(customer.invoices.length)}
        />
        <MetricCard
          helper="Gross invoice value"
          label="Total billed"
          tone="green"
          value={money.format(totals.billed)}
        />
        <MetricCard
          helper="Opening balance plus unpaid invoices"
          label="Balance"
          tone={totals.balance > 0 ? "amber" : "green"}
          value={money.format(totals.balance)}
        />
      </section>

      <section className="grid gap-[11px] xl:grid-cols-[0.86fr_1.14fr]">
        <Card subtitle="Profile details" title="Edit customer">
          <CustomerForm
            customerId={customer.id}
            defaults={{
              address: customer.address ?? "",
              businessName: customer.businessName ?? "",
              email: customer.email ?? "",
              name: customer.name,
              notes: customer.notes ?? "",
              openingBalance: decimalInputValue(customer.openingBalance),
              phone: customer.phone ?? "",
              status: customer.status,
              taxNumber: customer.taxNumber ?? "",
            }}
            submitLabel="Update customer"
          />
        </Card>

        <div className="grid content-start gap-[11px]">
          <Card className="order-1" subtitle="Saved profile" title="Contact">
            <dl className="grid gap-2 text-xs">
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">Business</dt>
                <dd className="font-medium">
                  {customer.businessName || "Individual customer"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium">{customer.phone || "Not set"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{customer.email || "Not set"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Opening balance</dt>
                <dd className="font-mono font-medium">
                  {money.format(Number(customer.openingBalance))}
                </dd>
              </div>
            </dl>
          </Card>

          <Card
            className="order-3"
            subtitle="Manual activity"
            title="Add communication note"
          >
            <CommunicationNoteForm customerId={customer.id} />
          </Card>

          <CommunicationTimeline
            className="order-4"
            emptyDescription="Prepared invoice emails, sent emails, failed attempts, payments, and notes will appear here once activity is recorded."
            emptyTitle="No communication history yet"
            entries={timelineEntries}
            title="Customer communication history"
          />

          <Card
            className="order-2 overflow-hidden"
            subtitle={`Paid ${money.format(totals.paid)}`}
            title="Invoice history"
          >
            {customer.invoices.length === 0 ? (
              <EmptyState
                description="Customer invoices will appear here after the first draft is saved."
                title="No invoices yet"
              />
            ) : (
              <div className="max-h-[520px] overflow-y-auto overflow-x-hidden">
                <table className="responsive-data-table w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-[11px] text-[#94a3b8]">
                      <th className="pb-2 pr-4 font-normal">Invoice</th>
                      <th className="pb-2 pr-4 font-normal">Date</th>
                      <th className="pb-2 pr-4 text-right font-normal">Items</th>
                      <th className="pb-2 pr-4 text-right font-normal">Payment</th>
                      <th className="pb-2 text-right font-normal">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.invoices.map((invoice) => (
                      <tr
                        className="border-b border-border transition last:border-0 hover:bg-black/[0.015]"
                        key={invoice.id}
                      >
                        <td className="py-2.5 pr-4 align-top" data-label="Invoice">
                          <Link
                            className="font-medium text-[#185fa5]"
                            href={`/dashboard/invoices/${invoice.id}`}
                          >
                            {invoice.invoiceNumber}
                          </Link>
                          <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                            {money.format(Number(invoice.grandTotal))}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4 align-top text-muted-foreground" data-label="Date">
                          {dateFormatter(invoice.invoiceDate)}
                        </td>
                        <td className="py-2.5 pr-4 text-right align-top font-mono" data-label="Items">
                          {invoice._count.items}
                        </td>
                        <td className="py-2.5 pr-4 text-right align-top" data-label="Payment">
                          <StatusBadge label={paymentStatus(invoice)} />
                        </td>
                        <td className="py-2.5 text-right align-top font-mono font-medium" data-label="Balance">
                          {money.format(Number(invoice.balanceAmount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
