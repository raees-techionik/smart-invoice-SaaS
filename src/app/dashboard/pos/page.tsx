import Link from "next/link";

import { PosBillingForm } from "@/app/_frontend/components/dashboard/pos-billing-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { AppIcon, metricIconForLabel } from "@/app/_frontend/components/dashboard/app-icons";


function decimalInputValue(value: unknown) {
  return Number(value).toFixed(2);
}

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
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    end,
    start,
  };
}

function MetricCard({
  helper,
  label,
  tone,
  value,
}: {
  helper: string;
  label: string;
  tone: "amber" | "blue" | "green" | "red";
  value: string;
}) {
  const toneClasses = {
    amber: "bg-[#fff7ed] text-[#b45309]",
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    green: "bg-[#ecfdf5] text-[#047857]",
    red: "bg-[#fef2f2] text-[#b91c1c]",
  };
  const toneLineClasses = {
    amber: "from-[#f59e0b] to-[#f97316]",
    blue: "from-[#635bff] to-[#22d3ee]",
    green: "from-[#00a884] to-[#6ee7b7]",
    red: "from-[#ef4444] to-[#fb7185]",
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
        <div className="premium-visual-coin"><AppIcon className="size-5" name="pos" /></div>
      </div>
    </div>
  );
}

export default async function PosPage() {
  const user = await requireUser();
  const money = currencyFormatter(user.business.currency);
  const today = todayRange();
  const todayPosWhere = {
    businessId: user.businessId,
    invoiceDate: {
      gte: today.start,
      lt: today.end,
    },
    invoiceType: "pos",
    status: "finalized",
  };

  const [products, todayPosAggregate, todayPosCount, recentPosInvoices] =
    await Promise.all([
      prisma.product.findMany({
        orderBy: [
          {
            type: "asc",
          },
          {
            name: "asc",
          },
        ],
        select: {
          category: true,
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
          status: "active",
        },
      }),
      prisma.invoice.aggregate({
        _sum: {
          grandTotal: true,
          paidAmount: true,
        },
        where: todayPosWhere,
      }),
      prisma.invoice.count({
        where: todayPosWhere,
      }),
      prisma.invoice.findMany({
        include: {
          customer: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
        orderBy: {
          invoiceDate: "desc",
        },
        take: 5,
        where: {
          businessId: user.businessId,
          invoiceType: "pos",
          status: "finalized",
        },
      }),
    ]);
  const todaySales = Number(todayPosAggregate._sum.grandTotal ?? 0);
  const todayCollected = Number(todayPosAggregate._sum.paidAmount ?? 0);
  const averageBill = todayPosCount > 0 ? todaySales / todayPosCount : 0;
  const productItems = products.filter((product) => product.type === "product");
  const serviceItems = products.filter((product) => product.type !== "product");
  const lowStockItems = productItems.filter(
    (product) =>
      Number(product.lowStockAlert) > 0 &&
      Number(product.stockQuantity) <= Number(product.lowStockAlert),
  );
  const formProducts = products.map((product) => ({
    category: product.category,
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

  return (
    <div className="relative grid gap-3.5">
      <PremiumVisual />
      <header className="premium-card relative z-[1] grid gap-4 overflow-hidden rounded-[16px] border p-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#635bff]">
            POS-lite
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Fast counter billing
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Create walk-in customer bills, calculate cash change, print the
            finalized invoice, and deduct stock in one checkout flow.
          </p>
        </div>
        <div className="rounded-lg border border-white/70 bg-white/65 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Billing mode
          </p>
          <p className="mt-1 text-lg font-semibold">Walk-in cash</p>
        </div>
      </header>

      <section className="relative z-[1] grid gap-4 md:grid-cols-3">
        <MetricCard
          helper="Finalized POS invoices created today."
          label="Today's POS sales"
          tone="blue"
          value={money.format(todaySales)}
        />
        <MetricCard
          helper="Paid amount on today's POS bills."
          label="Cash collected"
          tone="green"
          value={money.format(todayCollected)}
        />
        <MetricCard
          helper="Counter receipts finalized today."
          label="Bills"
          tone="amber"
          value={String(todayPosCount)}
        />
      </section>

      <PosBillingForm currency={user.business.currency} products={formProducts} />

      <section className="relative z-[1] grid gap-3.5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="premium-card rounded-[16px] border p-4">
          <div className="flex items-center justify-between gap-4 border-b border-border p-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Daily POS summary
              </p>
              <h3 className="mt-1 text-[13px] font-medium">Recent receipts</h3>
            </div>
            <span className="text-sm text-muted-foreground">
              Today starts {dateFormatter(today.start)}
            </span>
          </div>
          {recentPosInvoices.length === 0 ? (
            <div className="grid min-h-40 place-items-center p-8 text-center">
              <div>
                <p className="text-lg font-semibold">No POS receipts yet</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Finalized counter bills will appear here for quick review.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentPosInvoices.map((invoice) => (
                <Link
                  className="flex items-start justify-between gap-4 py-3 transition hover:bg-[#635bff]/[0.04]"
                  href={`/dashboard/invoices/${invoice.id}`}
                  key={invoice.id}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {invoice.invoiceNumber}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {invoice.customer?.name ?? "Walk-in Customer"}
                      {invoice.customer?.phone
                        ? ` - ${invoice.customer.phone}`
                        : ""}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {dateFormatter(invoice.invoiceDate)}
                    </span>
                  </span>
                  <span className="font-mono text-sm font-semibold">
                    {money.format(Number(invoice.grandTotal))}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard
            helper="Average finalized POS bill value."
            label="Average bill"
            tone="red"
            value={money.format(averageBill)}
          />
          <MetricCard
            helper="Active catalog items available for quick search."
            label="Active items"
            tone="blue"
            value={String(products.length)}
          />
          <MetricCard
            helper="Physical products that can deduct stock on finalization."
            label="Stock items"
            tone="green"
            value={String(productItems.length)}
          />
          <MetricCard
            helper="Items at or below low-stock alert levels."
            label="Low stock"
            tone="amber"
            value={String(lowStockItems.length)}
          />
        </div>
      </section>

      {serviceItems.length > 0 ? (
        <p className="relative z-[1] text-sm text-muted-foreground">
          Services are billable in POS-lite and do not affect inventory stock.
        </p>
      ) : null}
    </div>
  );
}
