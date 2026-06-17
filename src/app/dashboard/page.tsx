import Link from "next/link";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

const quickActions = [
  { href: "/dashboard/invoices", label: "New invoice", symbol: "+" },
  { href: "/dashboard/customers", label: "Customer", symbol: "CU" },
  { href: "/dashboard/products", label: "Product", symbol: "BX" },
  { href: "/dashboard/pos", label: "POS", symbol: "PS" },
];

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

function StatCard({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: "blue" | "green" | "amber" | "red";
  value: string;
}) {
  const toneClasses = {
    amber: "bg-[#faeeda] text-[#854f0b]",
    blue: "bg-[#e6f1fb] text-[#185fa5]",
    green: "bg-[#eaf3de] text-[#3b6d11]",
    red: "bg-[#fcebeb] text-[#a32d2d]",
  };

  return (
    <article className="rounded-[14px] border border-border bg-white p-[15px]">
      <div
        className={`mb-2.5 grid size-8 place-items-center rounded-lg text-[11px] font-semibold ${toneClasses[tone]}`}
      >
        {label.slice(0, 2).toUpperCase()}
      </div>
      <p className="font-mono text-[21px] font-medium leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-[10.5px] ${
          tone === "green"
            ? "text-[#3b6d11]"
            : tone === "red"
              ? "text-[#a32d2d]"
              : tone === "amber"
                ? "text-[#854f0b]"
                : "text-[#185fa5]"
        }`}
      >
        {detail}
      </p>
    </article>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  const toneClasses: Record<string, string> = {
    active: "bg-[#eaf3de] text-[#3b6d11]",
    draft: "border border-border bg-[#f8f9fa] text-muted-foreground",
    finalized: "bg-[#eaf3de] text-[#3b6d11]",
    low: "bg-[#faeeda] text-[#854f0b]",
    overdue: "bg-[#fcebeb] text-[#a32d2d]",
    paid: "bg-[#eaf3de] text-[#3b6d11]",
    partial: "bg-[#e6f1fb] text-[#185fa5]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium ${
        toneClasses[tone] ?? toneClasses.draft
      }`}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className="rounded-[14px] border border-border bg-white p-4">
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

export default async function DashboardPage() {
  const user = await requireUser();
  const money = currencyFormatter(user.business.currency);

  const [
    customerCount,
    productCount,
    invoiceCount,
    finalizedSales,
    refunds,
    openBalance,
    expenses,
    stockItems,
    unpaidInvoices,
    recentInvoices,
    recentPayments,
    topCustomers,
  ] = await Promise.all([
    prisma.customer.count({
      where: { businessId: user.businessId, status: "active" },
    }),
    prisma.product.count({
      where: { businessId: user.businessId },
    }),
    prisma.invoice.count({
      where: { businessId: user.businessId },
    }),
    prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      where: { businessId: user.businessId, status: "finalized" },
    }),
    prisma.refund.aggregate({
      _sum: { amount: true },
      where: { businessId: user.businessId, status: "completed" },
    }),
    prisma.invoice.aggregate({
      _sum: { balanceAmount: true },
      where: { businessId: user.businessId, status: "finalized" },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { businessId: user.businessId },
    }),
    prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        lowStockAlert: true,
        name: true,
        sku: true,
        stockQuantity: true,
        unit: true,
      },
      take: 5,
      where: { businessId: user.businessId, status: "active", type: "product" },
    }),
    prisma.invoice.count({
      where: {
        balanceAmount: { gt: 0 },
        businessId: user.businessId,
        status: "finalized",
      },
    }),
    prisma.invoice.findMany({
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
      where: { businessId: user.businessId },
    }),
    prisma.payment.findMany({
      include: { invoice: { select: { invoiceNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
      where: { businessId: user.businessId },
    }),
    prisma.customer.findMany({
      include: {
        invoices: {
          select: { grandTotal: true },
          where: { status: "finalized" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
      where: { businessId: user.businessId, status: "active" },
    }),
  ]);

  const totalSales = Number(finalizedSales._sum.grandTotal ?? 0);
  const totalRefunds = Number(refunds._sum.amount ?? 0);
  const netSales = totalSales - totalRefunds;
  const totalOpenBalance = Number(openBalance._sum.balanceAmount ?? 0);
  const totalExpenses = Number(expenses._sum.amount ?? 0);
  const estimatedProfit = netSales - totalExpenses;
  const lowStockItems = stockItems.filter(
    (product) =>
      Number(product.lowStockAlert) > 0 &&
      Number(product.stockQuantity) <= Number(product.lowStockAlert),
  );
  const customerRows = topCustomers
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      total: customer.invoices.reduce(
        (sum, invoice) => sum + Number(invoice.grandTotal),
        0,
      ),
    }))
    .sort((left, right) => right.total - left.total);

  return (
    <div className="flex flex-col gap-3.5">
      <section className="grid grid-cols-1 gap-[11px] md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail={`${invoiceCount} invoice records`}
          label="Net sales"
          tone="green"
          value={money.format(netSales)}
        />
        <StatCard
          detail={`${unpaidInvoices} invoices need follow-up`}
          label="Unpaid invoices"
          tone={unpaidInvoices > 0 ? "amber" : "blue"}
          value={`${unpaidInvoices}`}
        />
        <StatCard
          detail={`${lowStockItems.length} critical stock items`}
          label="Low stock alerts"
          tone={lowStockItems.length > 0 ? "amber" : "green"}
          value={`${lowStockItems.length}`}
        />
        <StatCard
          detail={`${customerCount} customers / ${productCount} catalog items`}
          label="Estimated profit"
          tone={estimatedProfit < 0 ? "red" : "blue"}
          value={money.format(estimatedProfit)}
        />
      </section>

      <section className="grid gap-[11px] xl:grid-cols-[1.6fr_1fr]">
        <Card subtitle="Live records" title="Recent invoices">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-normal text-[#94a3b8]">
                  <th className="pb-2 font-normal">Invoice</th>
                  <th className="pb-2 font-normal">Customer</th>
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 font-normal">Status</th>
                  <th className="pb-2 text-right font-normal">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td className="py-8 text-center text-muted-foreground" colSpan={5}>
                      No invoices yet.
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map((invoice) => (
                    <tr
                      className="border-b border-border last:border-0"
                      key={invoice.id}
                    >
                      <td className="truncate py-2 pr-3">
                        <Link
                          className="font-medium text-[#185fa5]"
                          href={`/dashboard/invoices/${invoice.id}`}
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="truncate py-2 pr-3 text-muted-foreground">
                        {invoice.customer?.name ?? "No customer"}
                      </td>
                      <td className="truncate py-2 pr-3 text-muted-foreground">
                        {dateFormatter(invoice.createdAt)}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge tone={invoice.status}>{invoice.status}</Badge>
                      </td>
                      <td className="py-2 text-right font-mono font-medium">
                        {money.format(Number(invoice.grandTotal))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card subtitle="Tap to start" title="Quick actions">
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <Link
                className="flex items-center justify-center gap-1 rounded-lg border border-border bg-[#f8f9fa] px-2 py-2 text-[11.5px] transition hover:bg-[#e6f1fb]"
                href={action.href}
                key={action.label}
              >
                <span className="text-[10px] font-semibold text-[#185fa5]">
                  {action.symbol}
                </span>
                {action.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-[10px] border border-border bg-[#f8f9fa] p-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Receivables</span>
              <span className="font-mono font-medium">
                {money.format(totalOpenBalance)}
              </span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-border">
              <div
                className="h-full rounded-full bg-[#378add]"
                style={{
                  width: `${Math.min(
                    totalSales > 0 ? (totalOpenBalance / totalSales) * 100 : 0,
                    100,
                  )}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[10.5px] text-[#94a3b8]">
              {unpaidInvoices} unpaid finalized invoices.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-[11px] xl:grid-cols-3">
        <Card subtitle="Operational warning" title="Inventory alerts">
          <div className="flex flex-col gap-2">
            {lowStockItems.length === 0 ? (
              <p className="rounded-lg bg-[#eaf3de] p-3 text-[11.5px] text-[#3b6d11]">
                No active low-stock alerts.
              </p>
            ) : (
              lowStockItems.map((product) => (
                <Link
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-[#f8f9fa] p-3"
                  href={`/dashboard/products/${product.id}`}
                  key={product.id}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {product.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-[#94a3b8]">
                      {product.sku || "No SKU"}
                    </span>
                  </span>
                  <Badge tone="low">
                    {Number(product.stockQuantity).toFixed(0)}{" "}
                    {product.unit || "units"}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card subtitle="Collections" title="Recent payments">
          <div className="flex flex-col">
            {recentPayments.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No payments yet.
              </p>
            ) : (
              recentPayments.map((payment) => (
                <Link
                  className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                  href={`/dashboard/invoices/${payment.invoiceId}`}
                  key={payment.id}
                >
                  <span>
                    <span className="block text-xs font-medium">
                      {payment.invoice.invoiceNumber}
                    </span>
                    <span className="mt-0.5 block text-[10.5px] text-[#94a3b8]">
                      {dateFormatter(payment.paymentDate)}
                    </span>
                  </span>
                  <span className="font-mono text-xs font-medium text-[#3b6d11]">
                    +{money.format(Number(payment.amount))}
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card subtitle="By finalized sales" title="Top customers">
          <div className="flex flex-col gap-3">
            {customerRows.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No customer sales yet.
              </p>
            ) : (
              customerRows.map((customer) => {
                const width =
                  customerRows[0]?.total && customerRows[0].total > 0
                    ? (customer.total / customerRows[0].total) * 100
                    : 0;

                return (
                  <Link href={`/dashboard/customers/${customer.id}`} key={customer.id}>
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span className="truncate">{customer.name}</span>
                      <span className="font-mono font-medium">
                        {money.format(customer.total)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-[#378add]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
