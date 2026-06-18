import type { ReactNode } from "react";
import Link from "next/link";

import { InvoiceForm } from "@/app/_frontend/components/dashboard/invoice-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { parseInvoiceTemplateSettings } from "@/app/_backend/lib/invoice-templates";

function currencyFormatter(currency: string) {
  return new Intl.NumberFormat("en-PK", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  });
}

function dateFormatter(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
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

function Badge({ children, tone }: { children: ReactNode; tone: string }) {
  const toneClasses: Record<string, string> = {
    draft: "border border-border bg-[#f8f9fa] text-muted-foreground",
    finalized: "bg-[#eaf3de] text-[#3b6d11]",
    paid: "bg-[#eaf3de] text-[#3b6d11]",
    partial: "bg-[#e6f1fb] text-[#185fa5]",
    unpaid: "bg-[#faeeda] text-[#854f0b]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium capitalize ${
        toneClasses[tone.toLowerCase()] ?? toneClasses.draft
      }`}
    >
      {children}
    </span>
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
  tone: "blue" | "green" | "amber";
  value: string | number;
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
    <article className="premium-card premium-card-hover relative overflow-hidden rounded-[16px] border p-[15px]">
      <div
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${toneLineClasses[tone]}`}
      />
      <div
        className={`premium-stat-icon mb-2.5 grid size-8 place-items-center rounded-lg text-[11px] font-semibold ${toneClasses[tone]}`}
      >
        {label.slice(0, 2).toUpperCase()}
      </div>
      <p className="font-mono text-[21px] font-medium leading-none">{value}</p>
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
        <div className="premium-visual-coin">INV</div>
      </div>
    </div>
  );
}

function Card({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className="premium-card rounded-[16px] border p-4">
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

export default async function InvoicesPage() {
  const user = await requireUser();
  const money = currencyFormatter(user.business.currency);

  const [
    customers,
    products,
    templates,
    invoices,
    totalInvoices,
    draftInvoices,
    finalizedInvoices,
    balanceAggregate,
    revenueAggregate,
  ] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { businessName: true, id: true, name: true },
      where: { businessId: user.businessId, status: "active" },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
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
      where: { businessId: user.businessId, status: "active" },
    }),
    prisma.invoiceTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, isDefault: true, name: true, settings: true },
      where: { businessId: user.businessId },
    }),
    prisma.invoice.findMany({
      include: {
        _count: { select: { items: true } },
        customer: { select: { businessName: true, name: true } },
        template: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: { businessId: user.businessId },
    }),
    prisma.invoice.count({ where: { businessId: user.businessId } }),
    prisma.invoice.count({
      where: { businessId: user.businessId, status: "draft" },
    }),
    prisma.invoice.count({
      where: { businessId: user.businessId, status: "finalized" },
    }),
    prisma.invoice.aggregate({
      _sum: { balanceAmount: true },
      where: { businessId: user.businessId },
    }),
    prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: { businessId: user.businessId, status: "finalized" },
    }),
  ]);

  const formProducts = products.map((product) => ({
    id: product.id,
    lowStockAlert: Number(product.lowStockAlert).toFixed(2),
    name: product.name,
    salePrice: Number(product.salePrice).toFixed(2),
    sku: product.sku,
    stockQuantity: Number(product.stockQuantity).toFixed(2),
    taxRate: Number(product.taxRate).toFixed(2),
    type: product.type,
    unit: product.unit,
  }));
  const formTemplates = templates.map((template) => ({
    id: template.id,
    isDefault: template.isDefault,
    name: template.name,
    settings: parseInvoiceTemplateSettings(template.settings),
  }));
  const openBalance = Number(balanceAggregate._sum.balanceAmount ?? 0);
  const revenue = Number(revenueAggregate._sum.grandTotal ?? 0);

  return (
    <div className="relative flex flex-col gap-3.5">
      <PremiumVisual />
      <section className="relative z-[1] grid grid-cols-1 gap-[11px] md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail={`${finalizedInvoices} finalized records`}
          label="Total invoices"
          tone="blue"
          value={totalInvoices}
        />
        <StatCard
          detail="Editable before stock deduction"
          label="Draft invoices"
          tone="amber"
          value={draftInvoices}
        />
        <StatCard
          detail="Finalized invoice revenue"
          label="Revenue"
          tone="green"
          value={money.format(revenue)}
        />
        <StatCard
          detail="Amount still receivable"
          label="Open balance"
          tone={openBalance > 0 ? "amber" : "green"}
          value={money.format(openBalance)}
        />
      </section>

      <section className="relative z-[1] grid gap-[11px] 2xl:grid-cols-[minmax(0,1.45fr)_340px]">
        <Card subtitle="Draft workspace" title="New invoice">
          <InvoiceForm
            customers={customers}
            defaultNotes={user.business.defaultNotes ?? ""}
            defaultTerms={user.business.defaultTerms ?? ""}
            products={formProducts}
            templates={formTemplates}
          />
        </Card>

        <div className="grid content-start gap-[11px]">
          <Card subtitle="Live defaults" title="Invoice setup">
            <div className="grid gap-3 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Customers</span>
                <span className="font-mono font-medium">{customers.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Products/services</span>
                <span className="font-mono font-medium">{products.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Templates</span>
                <span className="font-mono font-medium">{templates.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Prefix</span>
                <span className="font-mono font-medium">
                  {user.business.invoicePrefix}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                className="premium-soft-button flex items-center justify-center rounded-lg border px-2 py-2 text-[11.5px] transition hover:border-[#635bff]/30 hover:bg-white"
                href="/dashboard/customers"
              >
                Add customer
              </Link>
              <Link
                className="premium-soft-button flex items-center justify-center rounded-lg border px-2 py-2 text-[11.5px] transition hover:border-[#635bff]/30 hover:bg-white"
                href="/dashboard/products"
              >
                Add product
              </Link>
            </div>
          </Card>

          <Card subtitle="Preview" title="Invoice summary">
            <div className="rounded-[12px] border border-white/70 bg-white/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <div className="border-b border-border pb-3">
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-[#185fa5]">
                  {user.business.name}
                </p>
                <p className="mt-2 text-lg font-medium">Invoice</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  Save a draft to preview the final invoice layout and branded
                  PDF.
                </p>
              </div>
              <dl className="grid gap-2 py-3 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Invoice no.</dt>
                  <dd className="font-mono font-medium">
                    {user.business.invoicePrefix}-00001
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge tone="draft">Draft</Badge>
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-2">
                  <dt className="font-medium">Amount due</dt>
                  <dd className="font-mono font-medium">{money.format(0)}</dd>
                </div>
              </dl>
            </div>
          </Card>
        </div>
      </section>

      <div className="relative z-[1]">
      <Card subtitle={`Showing ${invoices.length} latest records`} title="Latest invoices">
        {invoices.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-center">
            <div>
              <p className="text-sm font-medium">No invoices yet</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                Save your first draft to test customer, product, and total
                calculation flow.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-normal text-[#94a3b8]">
                  <th className="w-[17%] pb-2 font-normal">Invoice</th>
                  <th className="w-[22%] pb-2 font-normal">Customer</th>
                  <th className="w-[16%] pb-2 font-normal">Template</th>
                  <th className="w-[11%] pb-2 font-normal">Date</th>
                  <th className="w-[8%] pb-2 text-right font-normal">Items</th>
                  <th className="w-[13%] pb-2 text-right font-normal">Total</th>
                  <th className="w-[13%] pb-2 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const invoicePaymentStatus = paymentStatus(invoice);

                  return (
                    <tr
                      className="border-b border-border transition last:border-0 hover:bg-[#635bff]/[0.04]"
                      key={invoice.id}
                    >
                      <td className="truncate py-2 pr-3">
                        <Link
                          className="font-medium text-[#185fa5]"
                          href={`/dashboard/invoices/${invoice.id}`}
                        >
                          {invoice.invoiceNumber}
                        </Link>
                        <p className="mt-1 truncate text-[10.5px] text-[#94a3b8]">
                          Balance {money.format(Number(invoice.balanceAmount))}
                        </p>
                      </td>
                      <td className="truncate py-2 pr-3">
                        <p className="truncate">{invoice.customer?.name ?? "No customer"}</p>
                        <p className="mt-1 truncate text-[10.5px] text-[#94a3b8]">
                          {invoice.customer?.businessName ?? "Individual"}
                        </p>
                      </td>
                      <td className="truncate py-2 pr-3 text-muted-foreground">
                        {invoice.template?.name ?? "No template"}
                      </td>
                      <td className="truncate py-2 pr-3 text-muted-foreground">
                        {dateFormatter(invoice.invoiceDate)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        {invoice._count.items}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-medium">
                        {money.format(Number(invoice.grandTotal))}
                      </td>
                      <td className="py-2 text-right">
                        <span className="inline-flex flex-col items-end gap-1">
                          <Badge tone={invoice.status}>{invoice.status}</Badge>
                          <Badge tone={invoicePaymentStatus}>
                            {invoicePaymentStatus}
                          </Badge>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
