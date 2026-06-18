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

function monthFormatter(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
  }).format(date);
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getRecentMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);

    return {
      date,
      key: getMonthKey(date),
      label: monthFormatter(date),
    };
  });
}

function makeLinePoints(values: number[], maxValue: number) {
  if (values.length === 0) {
    return "";
  }

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 92 - (Math.max(value, 0) / maxValue) * 76;

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function makeAreaPoints(values: number[], maxValue: number) {
  const line = makeLinePoints(values, maxValue);

  return line ? `0,96 ${line} 100,96` : "";
}

function sumNumbers(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
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

function PremiumVisual() {
  return (
    <div className="premium-visual hidden xl:block" aria-hidden="true">
      <div className="premium-visual-rig">
        <div className="premium-visual-floor" />
        <div className="premium-visual-sheet" />
        <div className="premium-visual-cube" />
        <div className="premium-visual-coin">Rs</div>
      </div>
    </div>
  );
}

function RevenueOverviewChart({
  collections,
  expenses,
  labels,
  money,
  sales,
}: {
  collections: number[];
  expenses: number[];
  labels: string[];
  money: Intl.NumberFormat;
  sales: number[];
}) {
  const maxValue = Math.max(...sales, ...collections, ...expenses, 1);
  const salesPoints = makeLinePoints(sales, maxValue);
  const collectionPoints = makeLinePoints(collections, maxValue);
  const expensePoints = makeLinePoints(expenses, maxValue);
  const salesArea = makeAreaPoints(sales, maxValue);

  return (
    <Card
      subtitle={`${labels[0]} to ${labels[labels.length - 1]}`}
      title="Revenue overview"
    >
      <div className="mb-4 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
        <div>
          <span className="mr-1 inline-block size-2 rounded-full bg-[#635bff]" />
          Sales{" "}
          <span className="font-mono text-foreground">
            {money.format(sumNumbers(sales))}
          </span>
        </div>
        <div>
          <span className="mr-1 inline-block size-2 rounded-full bg-[#00a884]" />
          Collections{" "}
          <span className="font-mono text-foreground">
            {money.format(sumNumbers(collections))}
          </span>
        </div>
        <div>
          <span className="mr-1 inline-block size-2 rounded-full bg-[#f43f5e]" />
          Expenses{" "}
          <span className="font-mono text-foreground">
            {money.format(sumNumbers(expenses))}
          </span>
        </div>
      </div>
      <div className="relative flex h-[220px] flex-col overflow-hidden rounded-[14px] border border-white/70 bg-white/50 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <svg
          aria-label="Revenue overview chart"
          className="min-h-0 flex-1 overflow-visible"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="dashboardSalesArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#635bff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#635bff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[16, 35, 54, 73, 92].map((y) => (
            <line
              key={y}
              stroke="rgba(121,139,171,.22)"
              strokeWidth="0.35"
              x1="0"
              x2="100"
              y1={y}
              y2={y}
            />
          ))}
          <polygon fill="url(#dashboardSalesArea)" points={salesArea} />
          <polyline
            fill="none"
            points={salesPoints}
            stroke="#635bff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            fill="none"
            points={collectionPoints}
            stroke="#00a884"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.3"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            fill="none"
            points={expensePoints}
            stroke="#f43f5e"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
          {sales.map((value, index) => {
            const x = sales.length === 1 ? 0 : (index / (sales.length - 1)) * 100;
            const y = 92 - (Math.max(value, 0) / maxValue) * 76;

            return (
              <circle
                cx={x}
                cy={y}
                fill="#ffffff"
                key={`${labels[index]}-${value}`}
                r="1.6"
                stroke="#635bff"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        <div className="mt-2 grid shrink-0 grid-cols-6 text-[10.5px] text-[#94a3b8]">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function RevenueSplitCard({
  money,
  rows,
}: {
  money: Intl.NumberFormat;
  rows: Array<{ color: string; label: string; value: number }>;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let cursor = 0;
  const gradientStops =
    total > 0
      ? rows
          .map((row) => {
            const start = cursor;
            const size = (row.value / total) * 100;
            cursor += size;
            return `${row.color} ${start}% ${cursor}%`;
          })
          .join(", ")
      : "#dbe5f1 0% 100%";

  return (
    <Card subtitle="Finalized mix" title="Revenue split">
      <div className="grid gap-5 sm:grid-cols-[140px_1fr] xl:grid-cols-1 2xl:grid-cols-[140px_1fr]">
        <div className="grid place-items-center">
          <div
            className="grid size-[126px] place-items-center rounded-full shadow-[0_18px_36px_rgba(30,45,75,0.12)]"
            style={{ background: `conic-gradient(${gradientStops})` }}
          >
            <div className="grid size-[82px] place-items-center rounded-full bg-white/95 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div>
                <p className="font-mono text-[15px] font-semibold">
                  {total > 0 ? "100%" : "0%"}
                </p>
                <p className="text-[10px] text-muted-foreground">Revenue</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          {rows.map((row) => {
            const percent = total > 0 ? (row.value / total) * 100 : 0;

            return (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.label}
                  </span>
                  <span className="font-mono font-medium">
                    {money.format(row.value)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-border">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: row.color,
                      width: `${Math.max(percent, row.value > 0 ? 4 : 0)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-right text-[10px] text-[#94a3b8]">
                  {percent.toFixed(0)}%
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const money = currencyFormatter(user.business.currency);
  const recentMonths = getRecentMonths(6);
  const chartStartDate = recentMonths[0]?.date ?? new Date();

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
    monthlyInvoices,
    monthlyPayments,
    monthlyExpenses,
    revenueSplitItems,
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
    prisma.invoice.findMany({
      select: {
        grandTotal: true,
        invoiceDate: true,
      },
      where: {
        businessId: user.businessId,
        invoiceDate: { gte: chartStartDate },
        status: "finalized",
      },
    }),
    prisma.payment.findMany({
      select: {
        amount: true,
        paymentDate: true,
      },
      where: {
        businessId: user.businessId,
        paymentDate: { gte: chartStartDate },
      },
    }),
    prisma.expense.findMany({
      select: {
        amount: true,
        date: true,
      },
      where: {
        businessId: user.businessId,
        date: { gte: chartStartDate },
        status: "active",
      },
    }),
    prisma.invoiceItem.findMany({
      select: {
        lineTotal: true,
        invoice: {
          select: {
            invoiceType: true,
          },
        },
        product: {
          select: {
            type: true,
          },
        },
      },
      where: {
        invoice: {
          businessId: user.businessId,
          status: "finalized",
        },
      },
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
  const monthlySalesMap = new Map(recentMonths.map((month) => [month.key, 0]));
  const monthlyCollectionsMap = new Map(
    recentMonths.map((month) => [month.key, 0]),
  );
  const monthlyExpensesMap = new Map(recentMonths.map((month) => [month.key, 0]));

  monthlyInvoices.forEach((invoice) => {
    const key = getMonthKey(invoice.invoiceDate);
    monthlySalesMap.set(
      key,
      (monthlySalesMap.get(key) ?? 0) + Number(invoice.grandTotal),
    );
  });
  monthlyPayments.forEach((payment) => {
    const key = getMonthKey(payment.paymentDate);
    monthlyCollectionsMap.set(
      key,
      (monthlyCollectionsMap.get(key) ?? 0) + Number(payment.amount),
    );
  });
  monthlyExpenses.forEach((expense) => {
    const key = getMonthKey(expense.date);
    monthlyExpensesMap.set(
      key,
      (monthlyExpensesMap.get(key) ?? 0) + Number(expense.amount),
    );
  });

  const monthlySales = recentMonths.map(
    (month) => monthlySalesMap.get(month.key) ?? 0,
  );
  const monthlyCollections = recentMonths.map(
    (month) => monthlyCollectionsMap.get(month.key) ?? 0,
  );
  const monthlyExpenseValues = recentMonths.map(
    (month) => monthlyExpensesMap.get(month.key) ?? 0,
  );
  const splitTotals = revenueSplitItems.reduce(
    (totals, item) => {
      const value = Number(item.lineTotal);

      if (item.invoice.invoiceType === "pos") {
        totals.pos += value;
      } else if (item.product?.type === "service") {
        totals.services += value;
      } else if (item.product?.type === "product") {
        totals.products += value;
      } else {
        totals.manual += value;
      }

      return totals;
    },
    { manual: 0, pos: 0, products: 0, services: 0 },
  );
  const revenueSplitRows = [
    { color: "#635bff", label: "Services", value: splitTotals.services },
    { color: "#00a884", label: "Products", value: splitTotals.products },
    { color: "#22d3ee", label: "POS", value: splitTotals.pos },
    { color: "#94a3b8", label: "Manual", value: splitTotals.manual },
    { color: "#f43f5e", label: "Refunds", value: totalRefunds },
  ].filter((row) => row.value > 0 || row.label !== "Manual");

  return (
    <div className="relative flex flex-col gap-3.5">
      <PremiumVisual />
      <section className="relative z-[1] grid grid-cols-1 gap-[11px] md:grid-cols-2 xl:grid-cols-4">
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

      <section className="relative z-[1] grid gap-[11px] xl:grid-cols-[1.6fr_1fr]">
        <RevenueOverviewChart
          collections={monthlyCollections}
          expenses={monthlyExpenseValues}
          labels={recentMonths.map((month) => month.label)}
          money={money}
          sales={monthlySales}
        />
        <RevenueSplitCard money={money} rows={revenueSplitRows} />
      </section>

      <section className="relative z-[1] grid gap-[11px] xl:grid-cols-[1.6fr_1fr]">
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
                className="premium-soft-button flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11.5px] transition hover:border-[#635bff]/30 hover:bg-white"
                href={action.href}
                key={action.label}
              >
                <span className="text-[10px] font-semibold text-[#635bff]">
                  {action.symbol}
                </span>
                {action.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-[12px] border border-white/70 bg-white/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Receivables</span>
              <span className="font-mono font-medium">
                {money.format(totalOpenBalance)}
              </span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-border">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#635bff] to-[#14b8a6]"
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

      <section className="relative z-[1] grid gap-[11px] xl:grid-cols-3">
        <Card subtitle="Operational warning" title="Inventory alerts">
          <div className="flex flex-col gap-2">
            {lowStockItems.length === 0 ? (
              <p className="rounded-lg bg-[#eaf3de] p-3 text-[11.5px] text-[#3b6d11]">
                No active low-stock alerts.
              </p>
            ) : (
              lowStockItems.map((product) => (
                <Link
                className="premium-soft-button flex items-center justify-between gap-3 rounded-[10px] border p-3 transition hover:border-[#f59e0b]/40 hover:bg-white"
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
                  className="flex items-center justify-between gap-3 border-b border-border py-2 transition last:border-0 hover:text-[#635bff]"
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
                        className="h-full rounded-full bg-gradient-to-r from-[#635bff] to-[#14b8a6]"
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
