import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AutoPrintTrigger } from "@/app/_frontend/components/dashboard/auto-print-trigger";
import { CommunicationNoteForm } from "@/app/_frontend/components/dashboard/communication-note-form";
import { CommunicationTimeline } from "@/app/_frontend/components/dashboard/communication-timeline";
import { FinalizeInvoiceForm } from "@/app/_frontend/components/dashboard/finalize-invoice-form";
import { InvoiceForm } from "@/app/_frontend/components/dashboard/invoice-form";
import { PaymentForm } from "@/app/_frontend/components/dashboard/payment-form";
import { PrintButton } from "@/app/_frontend/components/dashboard/print-button";
import { RefundForm } from "@/app/_frontend/components/dashboard/refund-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { buildInvoiceCommunicationTimeline } from "@/app/_backend/lib/communication-timeline";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { parseInvoiceTemplateSettings } from "@/app/_backend/lib/invoice-templates";
import { AppIcon, metricIconForLabel } from "@/app/_frontend/components/dashboard/app-icons";


type InvoiceDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    print?: string;
  }>;
};

function currencyFormatter(currency: string) {
  return new Intl.NumberFormat("en-PK", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  });
}

function dateFormatter(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function dateTimeFormatter(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function dateInputValue(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function decimalInputValue(value: unknown) {
  return Number(value).toFixed(2);
}

function decimalText(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(2);
}

function movementLabel(type: string) {
  return type.replace(/_/g, " ");
}

function statusTone(status: string) {
  if (status === "sent" || status === "completed" || status === "paid") {
    return "bg-[#eaf3de] text-[#3b6d11]";
  }

  if (status === "failed") {
    return "bg-[#fcebeb] text-[#a32d2d]";
  }

  if (status === "sending" || status === "finalized" || status === "partial") {
    return "bg-[#e6f1fb] text-[#185fa5]";
  }

  return "bg-[#faeeda] text-[#854f0b]";
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

function StatusBadge({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium capitalize ${statusTone(
        tone,
      )}`}
    >
      {children}
    </span>
  );
}

function ActionLink({
  children,
  href,
  primary = false,
  target,
}: {
  children: ReactNode;
  href: string;
  primary?: boolean;
  target?: string;
}) {
  return (
    <Link
      className={`inline-flex h-[34px] items-center justify-center rounded-lg px-3 text-[11.5px] font-medium transition ${
        primary
          ? "premium-button text-white hover:brightness-105"
          : "premium-soft-button border hover:border-[#635bff]/30 hover:bg-white"
      }`}
      href={href}
      rel={target ? "noreferrer" : undefined}
      target={target}
    >
      {children}
    </Link>
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
    <section
      className={`premium-card rounded-[16px] border p-4 print:hidden ${className}`}
    >
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

function StatCard({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: "blue" | "green" | "amber" | "red";
  value: string | number;
}) {
  const toneClasses = {
    amber: "bg-[#fff7ed] text-[#b45309]",
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    green: "bg-[#ecfdf5] text-[#047857]",
    red: "bg-[#fff1f2] text-[#be123c]",
  };
  const toneLineClasses = {
    amber: "from-[#f59e0b] to-[#f97316]",
    blue: "from-[#635bff] to-[#22d3ee]",
    green: "from-[#00a884] to-[#6ee7b7]",
    red: "from-[#f43f5e] to-[#fda4af]",
  };

  return (
    <article className="premium-card premium-card-hover relative overflow-hidden rounded-[16px] border p-[15px] print:hidden">
      <div
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${toneLineClasses[tone]}`}
      />
      <div
        className={`premium-stat-icon mb-2.5 grid size-8 place-items-center rounded-lg text-[11px] font-semibold ${toneClasses[tone]}`}
      >
        <AppIcon className="size-4" name={metricIconForLabel(label)} />
      </div>
      <p className="font-mono text-[20px] font-medium leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[10.5px] text-[#94a3b8]">{detail}</p>
    </article>
  );
}

function PremiumVisual() {
  return (
    <div className="premium-visual hidden xl:block" aria-hidden="true">
      <div className="premium-visual-rig">
        <div className="premium-visual-floor" />
        <div className="premium-visual-sheet" />
        <div className="premium-visual-cube" />
        <div className="premium-visual-coin"><AppIcon className="size-5" name="invoice" /></div>
      </div>
    </div>
  );
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: InvoiceDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const { print } = await searchParams;
  const money = currencyFormatter(user.business.currency);

  const invoice = await prisma.invoice.findFirst({
    include: {
      communicationNotes: {
        include: {
          createdBy: {
            select: {
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      customer: true,
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
      items: {
        include: {
          product: {
            select: {
              costPrice: true,
              id: true,
              name: true,
              type: true,
            },
          },
          refundItems: {
            include: {
              refund: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      template: true,
      inventoryMoves: {
        include: {
          product: {
            select: {
              name: true,
              sku: true,
              unit: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      payments: {
        orderBy: {
          paymentDate: "desc",
        },
      },
      refunds: {
        include: {
          createdBy: {
            select: {
              email: true,
              name: true,
            },
          },
          items: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
        orderBy: {
          refundDate: "desc",
        },
      },
    },
    where: {
      businessId: user.businessId,
      id,
    },
  });

  if (!invoice) {
    notFound();
  }

  const currentProductIds = invoice.items
    .map((item) => item.productId)
    .filter((productId): productId is string => Boolean(productId));

  const [customers, products, templates, recentItems] = await Promise.all([
    prisma.customer.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        businessName: true,
        id: true,
        name: true,
      },
      where: {
        businessId: user.businessId,
        status: "active",
      },
    }),
    prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        lowStockAlert: true,
        name: true,
        salePrice: true,
        sku: true,
        stockQuantity: true,
        taxRate: true,
        type: true,
        unit: true,
      },
      where: {
        businessId: user.businessId,
        OR: [
          {
            status: "active",
          },
          {
            id: {
              in: currentProductIds,
            },
          },
        ],
      },
    }),
    prisma.invoiceTemplate.findMany({
      orderBy: [
        {
          isDefault: "desc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        isDefault: true,
        name: true,
        settings: true,
      },
      where: {
        businessId: user.businessId,
      },
    }),
    prisma.invoiceItem.findMany({
      orderBy: { invoice: { invoiceDate: "desc" } },
      select: {
        invoice: { select: { customerId: true } },
        productId: true,
        unitPrice: true,
      },
      take: 2000,
      where: {
        invoice: { businessId: user.businessId, status: "finalized" },
        productId: { not: null },
      },
    }),
  ]);

  const historyMap = new Map<
    string,
    { customerId: string; count: number; lastUnitPrice: string; productId: string }
  >();
  for (const item of recentItems) {
    if (!item.productId || !item.invoice.customerId) continue;
    const key = `${item.invoice.customerId}:${item.productId}`;
    const existing = historyMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      historyMap.set(key, {
        customerId: item.invoice.customerId,
        count: 1,
        lastUnitPrice: Number(item.unitPrice).toFixed(2),
        productId: item.productId,
      });
    }
  }
  const customerHistory = [...historyMap.values()];

  const formProducts = products.map((product) => ({
    id: product.id,
    lowStockAlert: decimalInputValue(product.lowStockAlert),
    name: product.name,
    salePrice: decimalInputValue(product.salePrice),
    sku: product.sku,
    stockQuantity: decimalInputValue(product.stockQuantity),
    taxRate: decimalInputValue(product.taxRate),
    type: product.type,
    unit: product.unit,
  }));
  const initialLines = invoice.items
    .filter((item) => item.productId)
    .map((item) => ({
      discount: decimalInputValue(item.discount),
      productId: item.productId ?? "",
      quantity: decimalInputValue(item.quantity),
      taxRate: decimalInputValue(item.taxRate),
      unitPrice: decimalInputValue(item.unitPrice),
    }));
  const formTemplates = templates.map((template) => ({
    id: template.id,
    isDefault: template.isDefault,
    name: template.name,
    settings: parseInvoiceTemplateSettings(template.settings),
  }));
  const invoiceTemplateSettings = parseInvoiceTemplateSettings(
    invoice.template?.settings,
  );
  const isDraft = invoice.status === "draft";
  const isPosInvoice = invoice.invoiceType === "pos";
  const latestEmail = invoice.emailSends[0] ?? null;
  const latestPayment = invoice.payments[0] ?? null;
  const timelineEntries = buildInvoiceCommunicationTimeline(
    invoice,
    user.business.currency,
  );
  const canRecordPayment =
    invoice.status === "finalized" && Number(invoice.balanceAmount) > 0;
  const completedRefunds = invoice.refunds.filter(
    (refund) => refund.status === "completed",
  );
  const refundedAmount = completedRefunds.reduce(
    (total, refund) => total + Number(refund.amount),
    0,
  );
  const refundablePaidAmount = Math.max(
    Number(invoice.paidAmount) - refundedAmount,
    0,
  );
  const refundFormLines = invoice.items.map((item) => {
    const refundedQuantity = item.refundItems
      .filter((refundItem) => refundItem.refund.status === "completed")
      .reduce(
        (total, refundItem) => total + Number(refundItem.quantity),
        0,
      );
    const remainingQuantity = Math.max(Number(item.quantity) - refundedQuantity, 0);

    return {
      id: item.id,
      itemName: item.itemName,
      lineTotal: decimalInputValue(item.lineTotal),
      quantity: decimalInputValue(item.quantity),
      refundedQuantity: decimalInputValue(refundedQuantity),
      remainingQuantity: decimalInputValue(remainingQuantity),
      unit: item.unit,
      unitPrice: decimalInputValue(item.unitPrice),
    };
  });
  const invoiceProductUsage = initialLines.reduce<Record<string, number>>(
    (currentUsage, line) => ({
      ...currentUsage,
      [line.productId]:
        (currentUsage[line.productId] ?? 0) + Number(line.quantity),
    }),
    {},
  );
  const stockWarnings = formProducts
    .filter(
      (product) =>
        product.type === "product" &&
        (invoiceProductUsage[product.id] ?? 0) > Number(product.stockQuantity),
    )
    .map(
      (product) =>
        `${product.name}: required ${decimalText(
          invoiceProductUsage[product.id] ?? 0,
        )}, available ${decimalText(product.stockQuantity)} ${
          product.unit || "units"
        }`,
    );

  return (
    <div className="relative grid gap-3.5">
      <PremiumVisual />
      {print === "1" && !isDraft ? <AutoPrintTrigger /> : null}
      <header className="premium-card relative z-[1] order-1 overflow-hidden rounded-[16px] border p-4 print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#635bff]">
            Invoice
          </p>
            <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            {invoice.invoiceNumber}
          </h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
              {invoice.customer?.name ?? "No customer"} -{" "}
              {dateFormatter(invoice.invoiceDate)} -{" "}
              {money.format(Number(invoice.grandTotal))}
          </p>
        </div>
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/dashboard/invoices">Back</ActionLink>
          <PrintButton />
            <ActionLink href={`/dashboard/invoices/${invoice.id}/pdf`} target="_blank">
            Preview PDF
            </ActionLink>
            <ActionLink href={`/dashboard/invoices/${invoice.id}/pdf?download=1`}>
            Download PDF
            </ActionLink>
            <ActionLink href={`/dashboard/invoices/${invoice.id}/send`} primary>
            Prepare email
            </ActionLink>
          {isDraft ? (
            <FinalizeInvoiceForm
              invoiceId={invoice.id}
              stockWarnings={stockWarnings}
            />
          ) : null}
          </div>
        </div>
      </header>

      <section className="relative z-[1] order-2 grid gap-[11px] print:hidden md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          detail="Current invoice stage"
          label="Status"
          tone={isDraft ? "amber" : "green"}
          value={invoice.status}
        />
        <StatCard
          detail={`Due ${dateFormatter(invoice.dueDate)}`}
          label="Invoice date"
          tone="blue"
          value={dateFormatter(invoice.invoiceDate)}
        />
        <StatCard
          detail="Saved line items"
          label="Items"
          tone="blue"
          value={invoice.items.length}
        />
        <StatCard
          detail={`Paid ${money.format(Number(invoice.paidAmount))}`}
          label="Payment"
          tone={paymentStatus(invoice) === "Paid" ? "green" : "amber"}
          value={paymentStatus(invoice)}
        />
        <StatCard
          detail="Latest send status"
          label="Email"
          tone={latestEmail ? "blue" : "amber"}
          value={latestEmail ? "Draft ready" : "Not prepared"}
        />
      </section>

      {isDraft ? (
        <Card
          className="order-3"
          subtitle={invoice.template?.name ?? "No template"}
          title="Edit draft"
        >
          <InvoiceForm
            customerHistory={customerHistory}
            customers={customers}
            defaultNotes={user.business.defaultNotes ?? ""}
            defaultTerms={user.business.defaultTerms ?? ""}
            initialCustomerId={invoice.customerId ?? ""}
            initialDueDate={dateInputValue(invoice.dueDate)}
            initialInvoiceDate={dateInputValue(invoice.invoiceDate)}
            initialLines={initialLines}
            initialNotes={invoice.notes ?? ""}
            initialTemplateId={invoice.templateId ?? ""}
            initialTerms={invoice.terms ?? ""}
            invoiceId={invoice.id}
            products={formProducts}
            submitLabel="Update draft invoice"
            templates={formTemplates}
          />
        </Card>
      ) : null}

      {!isDraft ? (
        <section className="order-5 grid gap-[11px] print:hidden xl:grid-cols-[0.82fr_1.18fr]">
          <Card subtitle="Collection" title="New payment">
            {canRecordPayment ? (
              <PaymentForm
                invoiceId={invoice.id}
                maxAmount={decimalInputValue(invoice.balanceAmount)}
              />
            ) : (
              <p className="premium-soft-button rounded-[9px] border px-3 py-2 text-[11.5px] text-muted-foreground">
                This invoice has no open balance.
              </p>
            )}
          </Card>

          <Card
            className="overflow-hidden"
            subtitle={`${invoice.payments.length} records`}
            title="Payment history"
          >
            {invoice.payments.length === 0 ? (
              <EmptyState
                description="Record the first collection to reduce the invoice balance."
                title="No payments yet"
              />
            ) : (
              <div className="max-h-[420px] overflow-y-auto overflow-x-hidden">
                <table className="responsive-data-table w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-[11px] text-[#94a3b8]">
                      <th className="px-4 pb-2 font-normal">Date</th>
                      <th className="px-4 pb-2 font-normal">Method</th>
                      <th className="px-4 pb-2 font-normal">Notes</th>
                      <th className="px-4 pb-2 text-right font-normal">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((payment) => (
                      <tr
                        className="border-b border-border transition last:border-0 hover:bg-[#635bff]/[0.04]"
                        key={payment.id}
                      >
                        <td className="px-4 py-2.5 align-top" data-label="Date">
                          {dateFormatter(payment.paymentDate)}
                        </td>
                        <td className="px-4 py-2.5 align-top capitalize" data-label="Method">
                          {payment.paymentMethod.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-2.5 align-top text-muted-foreground" data-label="Notes">
                          {payment.notes || "No notes"}
                        </td>
                        <td className="px-4 py-2.5 text-right align-top font-mono font-medium" data-label="Amount">
                          {money.format(Number(payment.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      ) : null}

      {!isDraft ? (
        <section className="order-6 grid gap-[11px] print:hidden xl:grid-cols-[0.82fr_1.18fr]">
          <Card subtitle="Stock restoring" title="Returns and refunds">
              <p className="mb-3 text-[11.5px] leading-5 text-muted-foreground">
                Returned product quantities restore stock automatically. Refunds
                are recorded separately from invoice totals for audit history.
              </p>
            <RefundForm
              currency={user.business.currency}
              invoiceId={invoice.id}
              lines={refundFormLines}
              refundablePaidAmount={decimalInputValue(refundablePaidAmount)}
            />
          </Card>

          <Card
            className="overflow-hidden"
            subtitle={`Refunded ${money.format(refundedAmount)}`}
            title="Refund history"
          >
            {invoice.refunds.length === 0 ? (
              <EmptyState
                description="Product returns and cash refunds will appear here after the first refund is recorded."
                title="No refunds yet"
              />
            ) : (
              <div className="max-h-[420px] overflow-y-auto overflow-x-hidden">
                <table className="responsive-data-table w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-[11px] text-[#94a3b8]">
                      <th className="px-4 pb-2 font-normal">Refund</th>
                      <th className="px-4 pb-2 font-normal">Date</th>
                      <th className="px-4 pb-2 font-normal">Method</th>
                      <th className="px-4 pb-2 font-normal">Items</th>
                      <th className="px-4 pb-2 text-right font-normal">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.refunds.map((refund) => (
                      <tr
                        className="border-b border-border transition last:border-0 hover:bg-[#635bff]/[0.04]"
                        key={refund.id}
                      >
                        <td className="px-4 py-2.5 align-top" data-label="Refund">
                          <p className="font-medium">
                            {refund.refundNumber}
                          </p>
                          <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                            {refund.reason || refund.notes || refund.status}
                          </p>
                          <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                            By{" "}
                            {refund.createdBy?.name ||
                              refund.createdBy?.email ||
                              "Unknown user"}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 align-top text-muted-foreground" data-label="Date">
                          {dateFormatter(refund.refundDate)}
                        </td>
                        <td className="px-4 py-2.5 align-top capitalize" data-label="Method">
                          {refund.refundMethod.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-2.5 align-top text-muted-foreground" data-label="Items">
                          {refund.items.map((item) => (
                            <p key={item.id}>
                              {item.itemName} x {decimalText(item.quantity)}
                              {Number(item.restockQuantity) > 0
                                ? ` - restocked ${decimalText(
                                    item.restockQuantity,
                                  )}`
                              : ""}
                            </p>
                          ))}
                        </td>
                        <td className="px-4 py-2.5 text-right align-top font-mono font-medium" data-label="Amount">
                          {money.format(Number(refund.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      ) : null}

      <Card
        className="order-8"
        subtitle="Manual activity"
        title="Add communication note"
      >
        <CommunicationNoteForm
          customerId={invoice.customerId ?? undefined}
          invoiceId={invoice.id}
        />
      </Card>

      <CommunicationTimeline
        className="order-9"
        emptyDescription="Prepared email drafts, payments, and notes for this invoice will appear here."
        emptyTitle="No invoice activity yet"
        entries={timelineEntries}
        title="Invoice communication history"
      />

      <Card
        className="order-10 overflow-hidden"
        subtitle={`${invoice.emailSends.length} records`}
        title="Email history"
      >
        <div className="mb-3 flex justify-end">
          <ActionLink href={`/dashboard/invoices/${invoice.id}/send`} primary>
            Prepare email
          </ActionLink>
        </div>
        {invoice.emailSends.length === 0 ? (
          <EmptyState
            description="Prepare a copy-ready invoice email draft and attach the PDF from your email app."
            title="No prepared emails yet"
          />
        ) : (
          <div className="max-h-[420px] overflow-y-auto overflow-x-hidden">
            <table className="responsive-data-table w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] text-[#94a3b8]">
                  <th className="px-4 pb-2 font-normal">Recipient</th>
                  <th className="px-4 pb-2 font-normal">Subject</th>
                  <th className="px-4 pb-2 font-normal">Prepared by</th>
                  <th className="px-4 pb-2 font-normal">Date</th>
                  <th className="px-4 pb-2 text-right font-normal">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.emailSends.map((emailSend) => (
                  <tr
                    className="border-b border-border transition last:border-0 hover:bg-[#635bff]/[0.04]"
                    key={emailSend.id}
                  >
                    <td className="px-4 py-2.5 align-top" data-label="Recipient">
                      <p className="font-medium">
                        {emailSend.recipientEmail}
                      </p>
                      <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                        {emailSend.ccEmail
                          ? `CC: ${emailSend.ccEmail}`
                          : "No CC"}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 align-top" data-label="Subject">
                      {emailSend.subject}
                    </td>
                    <td className="px-4 py-2.5 align-top text-muted-foreground" data-label="Prepared by">
                      {emailSend.createdBy?.name ||
                        emailSend.createdBy?.email ||
                        "Unknown user"}
                    </td>
                    <td className="px-4 py-2.5 align-top text-muted-foreground" data-label="Date">
                      <p>{dateFormatter(emailSend.preparedAt)}</p>
                      {emailSend.sentAt ? (
                        <p className="mt-1">
                          Sent {dateFormatter(emailSend.sentAt)}
                        </p>
                      ) : null}
                      {emailSend.errorMessage ? (
                        <p className="mt-2 max-w-xs rounded-[7px] border border-[#e24b4a]/30 bg-[#fcebeb] px-3 py-2 text-[11px] leading-5 text-[#a32d2d]">
                          {emailSend.errorMessage}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-right align-top" data-label="Status">
                      <StatusBadge tone={emailSend.status}>
                        {emailSend.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!isDraft && invoice.inventoryMoves.length > 0 ? (
        <Card
          className="order-7 overflow-hidden"
          subtitle={`${invoice.inventoryMoves.length} records`}
          title="Stock impact"
        >
          <div className="max-h-[420px] overflow-y-auto overflow-x-hidden">
            <table className="responsive-data-table w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] text-[#94a3b8]">
                  <th className="px-4 pb-2 font-normal">Product</th>
                  <th className="px-4 pb-2 font-normal">Type</th>
                  <th className="px-4 pb-2 font-normal">Date</th>
                  <th className="px-4 pb-2 text-right font-normal">
                    Quantity
                  </th>
                  <th className="px-4 pb-2 text-right font-normal">
                    Unit cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.inventoryMoves.map((movement) => (
                  <tr
                    className="border-b border-border transition last:border-0 hover:bg-[#635bff]/[0.04]"
                    key={movement.id}
                  >
                    <td className="px-4 py-2.5 align-top" data-label="Product">
                      <p className="font-medium">{movement.product.name}</p>
                      <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                        {movement.product.sku || "No SKU"}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 align-top capitalize" data-label="Type">
                      {movementLabel(movement.type)}
                    </td>
                    <td className="px-4 py-2.5 align-top text-muted-foreground" data-label="Date">
                      {dateFormatter(movement.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right align-top font-mono font-medium" data-label="Quantity">
                      {decimalText(movement.quantity)}{" "}
                      {movement.product.unit || "units"}
                    </td>
                    <td className="px-4 py-2.5 text-right align-top font-mono" data-label="Unit cost">
                      {money.format(Number(movement.unitCost))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {isPosInvoice ? (
        <section className="order-[98] hidden bg-white text-black print:block print:w-[80mm] print:max-w-[80mm] print:p-2 print:font-mono print:text-[10px] print:leading-tight">
          <div className="border-b border-dashed border-black pb-2 text-center">
            <p className="text-sm font-bold uppercase">{user.business.name}</p>
            {user.business.address ? (
              <p className="mt-1">{user.business.address}</p>
            ) : null}
            {user.business.phone || user.business.email ? (
              <p className="mt-1">
                {user.business.phone || user.business.email}
              </p>
            ) : null}
            {user.business.taxNumber ? (
              <p className="mt-1">Tax ID: {user.business.taxNumber}</p>
            ) : null}
          </div>

          <div className="border-b border-dashed border-black py-2">
            <p className="text-center text-sm font-bold uppercase">
              POS Receipt
            </p>
            <div className="mt-2 grid gap-1">
              <div className="flex justify-between gap-3">
                <span>Receipt</span>
                <span className="font-bold">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Date</span>
                <span>{dateTimeFormatter(invoice.invoiceDate)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Customer</span>
                <span className="text-right">
                  {invoice.customer?.name ?? "Walk-in Customer"}
                </span>
              </div>
              {invoice.customer?.phone ? (
                <div className="flex justify-between gap-3">
                  <span>Phone</span>
                  <span>{invoice.customer.phone}</span>
                </div>
              ) : null}
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-dashed border-black">
                <th className="py-1 pr-1 text-left font-bold">Item</th>
                <th className="px-1 py-1 text-right font-bold">Qty</th>
                <th className="px-1 py-1 text-right font-bold">Rate</th>
                <th className="py-1 pl-1 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr className="border-b border-dotted border-black/50" key={item.id}>
                  <td className="py-1 pr-1 align-top">
                    <p className="font-bold">{item.itemName}</p>
                    {Number(item.discount) > 0 ? (
                      <p>Discount {money.format(Number(item.discount))}</p>
                    ) : null}
                  </td>
                  <td className="px-1 py-1 text-right align-top">
                    {decimalText(item.quantity)}
                  </td>
                  <td className="px-1 py-1 text-right align-top">
                    {money.format(Number(item.unitPrice))}
                  </td>
                  <td className="py-1 pl-1 text-right align-top font-bold">
                    {money.format(Number(item.lineTotal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="grid gap-1 border-b border-dashed border-black py-2">
            <div className="flex justify-between gap-3">
              <dt>Subtotal</dt>
              <dd>{money.format(Number(invoice.subtotal))}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Discount</dt>
              <dd>{money.format(Number(invoice.discountTotal))}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Tax</dt>
              <dd>{money.format(Number(invoice.taxTotal))}</dd>
            </div>
            <div className="flex justify-between gap-3 text-sm font-bold">
              <dt>Total</dt>
              <dd>{money.format(Number(invoice.grandTotal))}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Paid</dt>
              <dd>{money.format(Number(invoice.paidAmount))}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Balance</dt>
              <dd>{money.format(Number(invoice.balanceAmount))}</dd>
            </div>
            {latestPayment ? (
              <div className="flex justify-between gap-3">
                <dt>Payment</dt>
                <dd className="capitalize">
                  {latestPayment.paymentMethod.replaceAll("_", " ")}
                </dd>
              </div>
            ) : null}
          </dl>

          {latestPayment?.notes ? (
            <p className="border-b border-dashed border-black py-2">
              {latestPayment.notes}
            </p>
          ) : null}

          <div className="pt-2 text-center">
            <p className="font-bold">Thank you</p>
            <p className="mt-1">Goods once sold are subject to store policy.</p>
          </div>
        </section>
      ) : null}

      <section
        className={`premium-card relative z-[1] order-4 rounded-[16px] border p-4 ${
          isPosInvoice ? "print:hidden" : "print:border-0 print:p-0"
        }`}
      >
        {invoice.template ? (
          <div
            className="mb-4 h-1.5 rounded-full print:rounded-none"
            style={{ backgroundColor: invoiceTemplateSettings.accentColor }}
          />
        ) : null}
        <div
          className={`flex flex-col gap-4 border-b border-border pb-4 print:break-inside-avoid ${
            invoiceTemplateSettings.headerStyle === "boxed"
              ? "rounded-[12px] border border-white/70 bg-white/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
              : "sm:flex-row sm:items-start sm:justify-between"
          }`}
        >
          <div>
            <p
              className="text-[10.5px] font-medium uppercase tracking-[0.12em]"
              style={{
                color: invoice.template
                  ? invoiceTemplateSettings.accentColor
                  : undefined,
              }}
            >
              {user.business.name}
            </p>
            <h3 className="mt-2 text-[26px] font-semibold leading-none">Invoice</h3>
            <p className="mt-3 max-w-sm text-xs leading-5 text-muted-foreground">
              {user.business.address || "Business address not set"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user.business.phone || user.business.email || ""}
            </p>
            {invoiceTemplateSettings.showBusinessTaxNumber &&
            user.business.taxNumber ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Tax no. {user.business.taxNumber}
              </p>
            ) : null}
          </div>
          <dl className="grid gap-2 text-xs sm:text-right">
            <div>
              <dt className="text-muted-foreground">Invoice no.</dt>
              <dd className="font-mono font-medium">{invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-1 flex gap-1 sm:justify-end">
                <StatusBadge tone={invoice.status}>{invoice.status}</StatusBadge>
                <StatusBadge tone={paymentStatus(invoice)}>
                  {paymentStatus(invoice)}
                </StatusBadge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Template</dt>
              <dd className="font-medium">
                {invoice.template?.name ?? "No template"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Invoice date</dt>
              <dd className="font-medium">
                {dateFormatter(invoice.invoiceDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Due date</dt>
              <dd className="font-medium">{dateFormatter(invoice.dueDate)}</dd>
            </div>
          </dl>
        </div>

        <div
          className={`grid gap-4 border-b border-border py-4 print:break-inside-avoid ${
            invoiceTemplateSettings.layout === "modern"
              ? "sm:grid-cols-2"
              : "sm:grid-cols-[1.2fr_0.8fr]"
          }`}
        >
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Bill to</p>
            <p className="mt-2 text-[15px] font-medium">
              {invoice.customer?.name ?? "No customer"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {invoice.customer?.businessName ?? "Individual customer"}
            </p>
            <p className="mt-3 max-w-sm text-xs leading-5 text-muted-foreground">
              {invoice.customer?.address || "Customer address not set"}
            </p>
            {invoiceTemplateSettings.showCustomerContacts ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {invoice.customer?.phone || invoice.customer?.email || ""}
              </p>
            ) : null}
          </div>
          {invoiceTemplateSettings.showBalanceBox ? (
            <div className="rounded-[12px] border border-white/70 bg-white/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <p className="text-[11px] font-medium text-muted-foreground">
                Amount due
              </p>
              <p className="mt-2 font-mono text-[26px] font-medium leading-none">
                {money.format(Number(invoice.balanceAmount))}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Grand total {money.format(Number(invoice.grandTotal))}
              </p>
            </div>
          ) : null}
        </div>

        <div className="max-h-[520px] overflow-y-auto overflow-x-hidden py-4 print:max-h-none print:overflow-visible">
          <table className="print-static-table responsive-data-table w-full border-collapse text-left text-xs print:min-w-0">
            <thead>
              <tr className="border-b border-border text-[11px] text-[#94a3b8]">
                <th className="px-3 pb-2 font-normal">Item</th>
                <th className="px-3 pb-2 text-right font-normal">Qty</th>
                <th className="px-3 pb-2 text-right font-normal">Price</th>
                <th className="px-3 pb-2 text-right font-normal">
                  Discount
                </th>
                <th className="px-3 pb-2 text-right font-normal">Tax</th>
                <th className="px-3 pb-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr
                  className="border-b border-border transition print:break-inside-avoid last:border-0 hover:bg-[#635bff]/[0.04]"
                  key={item.id}
                >
                  <td className="px-3 py-2.5 align-top" data-label="Item">
                    <p className="font-medium">{item.itemName}</p>
                    {invoiceTemplateSettings.showItemDescriptions ? (
                      <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                        {item.description || item.unit || "Line item"}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top" data-label="Qty">
                    {decimalInputValue(item.quantity)}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top" data-label="Price">
                    {money.format(Number(item.unitPrice))}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top" data-label="Discount">
                    {money.format(Number(item.discount))}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top" data-label="Tax">
                    {money.format(Number(item.taxAmount))}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top font-mono font-medium" data-label="Total">
                    {money.format(Number(item.lineTotal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-5 border-t border-border pt-4 print:break-inside-avoid print:grid-cols-[1fr_300px] sm:grid-cols-[1fr_300px]">
          <div className="grid gap-3 text-xs text-muted-foreground">
            {invoiceTemplateSettings.paymentInstructions ? (
              <div>
                <p className="font-medium text-foreground">
                  Payment instructions
                </p>
                <p className="mt-1 leading-5">
                  {invoiceTemplateSettings.paymentInstructions}
                </p>
              </div>
            ) : null}
            {invoice.terms ? (
              <div>
                <p className="font-medium text-foreground">Terms</p>
                <p className="mt-1 leading-5">{invoice.terms}</p>
              </div>
            ) : null}
            {invoice.notes ? (
              <div>
                <p className="font-medium text-foreground">Notes</p>
                <p className="mt-1 leading-5">{invoice.notes}</p>
              </div>
            ) : null}
            {invoiceTemplateSettings.footerText ? (
              <div>
                <p className="font-medium text-foreground">Footer</p>
                <p className="mt-1 leading-5">
                  {invoiceTemplateSettings.footerText}
                </p>
              </div>
            ) : null}
            {invoice.template ? (
              <div className="flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#94a3b8]">
                {invoiceTemplateSettings.showLogo ? <span>Logo</span> : null}
                {invoiceTemplateSettings.showSignature ? (
                  <span>Signature</span>
                ) : null}
                {invoiceTemplateSettings.showStamp ? <span>Stamp</span> : null}
              </div>
            ) : null}
          </div>
          <dl className="grid gap-2 rounded-[12px] border border-white/70 bg-white/60 p-3 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-mono font-medium">
                {money.format(Number(invoice.subtotal))}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="font-mono font-medium">
                {money.format(Number(invoice.discountTotal))}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="font-mono font-medium">
                {money.format(Number(invoice.taxTotal))}
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-[14px]">
              <dt className="font-medium">Grand total</dt>
              <dd className="font-mono font-medium">
                {money.format(Number(invoice.grandTotal))}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="font-mono font-medium">
                {money.format(Number(invoice.paidAmount))}
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-[14px]">
              <dt className="font-medium">Balance due</dt>
              <dd className="font-mono font-medium">
                {money.format(Number(invoice.balanceAmount))}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
