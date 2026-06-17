import Link from "next/link";

import { PaymentForm } from "@/app/_frontend/components/dashboard/payment-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

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

function paymentStatus(invoice: {
  balanceAmount: unknown;
  grandTotal: unknown;
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

export default async function PaymentsPage() {
  const user = await requireUser();
  const money = currencyFormatter(user.business.currency);

  const [openInvoices, payments, totalPayments, paidAggregate, openAggregate] =
    await Promise.all([
      prisma.invoice.findMany({
        include: {
          customer: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          invoiceDate: "desc",
        },
        where: {
          balanceAmount: {
            gt: 0,
          },
          businessId: user.businessId,
          status: "finalized",
        },
      }),
      prisma.payment.findMany({
        include: {
          invoice: {
            include: {
              customer: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          paymentDate: "desc",
        },
        take: 25,
        where: {
          businessId: user.businessId,
        },
      }),
      prisma.payment.count({
        where: {
          businessId: user.businessId,
        },
      }),
      prisma.payment.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          businessId: user.businessId,
        },
      }),
      prisma.invoice.aggregate({
        _sum: {
          balanceAmount: true,
        },
        where: {
          businessId: user.businessId,
          status: "finalized",
        },
      }),
    ]);

  const invoiceOptions = openInvoices.map((invoice) => ({
    balanceAmount: money.format(Number(invoice.balanceAmount)),
    customerName: invoice.customer?.name ?? "No customer",
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
  }));
  const totalCollected = Number(paidAggregate._sum.amount ?? 0);
  const openBalance = Number(openAggregate._sum.balanceAmount ?? 0);

  return (
    <div className="grid gap-3.5">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
          Payments
        </p>
        <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
          Payment workflow
        </h2>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
          Record collections against finalized invoices and keep paid and
          balance amounts synchronized.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-white p-5">
          <p className="text-sm text-muted-foreground">Payment records</p>
          <p className="font-mono text-[21px] font-medium leading-none">{totalPayments}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          <p className="text-sm text-muted-foreground">Total collected</p>
          <p className="font-mono text-[21px] font-medium leading-none">
            {money.format(totalCollected)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          <p className="text-sm text-muted-foreground">Finalized open balance</p>
          <p className="font-mono text-[21px] font-medium leading-none">
            {money.format(openBalance)}
          </p>
        </div>
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="mb-5">
            <p className="text-sm font-medium text-muted-foreground">
              New payment
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              Apply payment to invoice
            </h3>
          </div>
          <PaymentForm invoiceOptions={invoiceOptions} />
        </div>

        <div className="rounded-lg border border-border bg-white">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Payment history
              </p>
              <h3 className="mt-1 text-[13px] font-medium">Recent payments</h3>
            </div>
            <span className="text-sm text-muted-foreground">
              Showing {payments.length} latest records
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="grid min-h-64 place-items-center p-8 text-center">
              <div>
                <p className="text-lg font-semibold">No payments recorded</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Finalize an invoice, then record the first collection here.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] border-collapse text-left text-sm">
                <thead className="text-[11px] text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Payment</th>
                    <th className="px-5 py-3 font-semibold">Invoice</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Method</th>
                    <th className="px-5 py-3 font-semibold">Invoice status</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold">
                          {dateFormatter(payment.paymentDate)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {payment.notes || "No notes"}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <Link
                          className="font-semibold text-accent hover:underline"
                          href={`/dashboard/invoices/${payment.invoiceId}`}
                        >
                          {payment.invoice.invoiceNumber}
                        </Link>
                        <p className="mt-1 text-muted-foreground">
                          Balance{" "}
                          {money.format(Number(payment.invoice.balanceAmount))}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {payment.invoice.customer?.name ?? "No customer"}
                      </td>
                      <td className="px-5 py-4 align-top capitalize">
                        {payment.paymentMethod.replaceAll("_", " ")}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className="rounded-sm bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                          {paymentStatus(payment.invoice)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right align-top font-semibold">
                        {money.format(Number(payment.amount))}
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
