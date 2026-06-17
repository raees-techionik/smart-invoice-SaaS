import { Prisma } from "@prisma/client";
import Link from "next/link";

import { CustomerForm } from "@/app/_frontend/components/dashboard/customer-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

type CustomersPageProps = {
  searchParams: Promise<{
    q?: string;
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
        {label.slice(0, 2).toUpperCase()}
      </div>
      <p className="font-mono text-[21px] font-medium leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[10.5px] text-[#94a3b8]">{helper}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";

  return (
    <span
      className={`inline-flex rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium capitalize ${
        active
          ? "bg-[#eaf3de] text-[#3b6d11]"
          : "border border-border bg-[#f8f9fa] text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const user = await requireUser();
  const { q } = await searchParams;
  const search = q?.trim() ?? "";
  const money = currencyFormatter(user.business.currency);

  const where: Prisma.CustomerWhereInput = {
    businessId: user.businessId,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { businessName: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };

  const [customers, totalCustomers, activeCustomers, balanceAggregate] =
    await Promise.all([
      prisma.customer.findMany({
        include: {
          _count: {
            select: {
              invoices: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 25,
        where,
      }),
      prisma.customer.count({
        where: {
          businessId: user.businessId,
        },
      }),
      prisma.customer.count({
        where: {
          businessId: user.businessId,
          status: "active",
        },
      }),
      prisma.customer.aggregate({
        _sum: {
          openingBalance: true,
        },
        where: {
          businessId: user.businessId,
        },
      }),
    ]);

  const totalOpeningBalance = Number(
    balanceAggregate._sum.openingBalance ?? 0,
  );

  return (
    <div className="grid gap-3.5">
      <header className="grid gap-4 rounded-[14px] border border-border bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Customers
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Customers
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Manage the buyer records that invoices, payments, and statements
            will build on.
          </p>
        </div>
        <form action="/dashboard/customers" className="flex gap-2">
          <input
            className="h-[34px] min-w-0 rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
            defaultValue={search}
            name="q"
            placeholder="Search customers"
          />
          <button
            className="h-[34px] rounded-lg bg-accent px-4 text-[12px] font-medium text-white transition hover:bg-[#2d7bc9]"
            type="submit"
          >
            Search
          </button>
        </form>
      </header>

      <section className="grid gap-[11px] md:grid-cols-3">
        <MetricCard
          helper="Profiles available for invoices and payments."
          label="Total customers"
          tone="blue"
          value={String(totalCustomers)}
        />
        <MetricCard
          helper="Ready for new invoices."
          label="Active customers"
          tone="green"
          value={String(activeCustomers)}
        />
        <MetricCard
          helper="Imported or manually entered balances."
          label="Opening balances"
          tone={totalOpeningBalance > 0 ? "amber" : "green"}
          value={money.format(totalOpeningBalance)}
        />
      </section>

      <section className="grid gap-[11px] xl:grid-cols-[0.88fr_1.12fr]">
        <div className="rounded-[14px] border border-border bg-white p-4">
          <div className="mb-[13px] flex items-center justify-between gap-4">
            <h3 className="text-[13px] font-medium">New customer</h3>
            <span className="text-[11px] text-[#94a3b8]">Profile setup</span>
          </div>
          <CustomerForm />
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="mb-[13px] flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 className="text-[13px] font-medium">
                {search ? `Matches for "${search}"` : "Latest customers"}
            </h3>
            <span className="text-[11px] text-[#94a3b8]">
              Showing {customers.length} of {search ? "matching" : "latest"}{" "}
              records
            </span>
          </div>

          {customers.length === 0 ? (
            <div className="grid min-h-40 place-items-center text-center">
              <div>
                <p className="text-sm font-medium">
                  {search ? "No matching customers" : "No customers yet"}
                </p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  {search
                    ? "Try a name, phone, email, or business name from the customer profile."
                    : "Create the first customer to make this a real working data screen."}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] text-[#94a3b8]">
                    <th className="pb-2 pr-4 font-normal">Customer</th>
                    <th className="pb-2 pr-4 font-normal">Contact</th>
                    <th className="pb-2 pr-4 text-right font-normal">Balance</th>
                    <th className="pb-2 pr-4 text-right font-normal">Invoices</th>
                    <th className="pb-2 pr-4 text-right font-normal">Status</th>
                    <th className="pb-2 text-right font-normal">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      className="border-b border-border transition last:border-0 hover:bg-black/[0.015]"
                      key={customer.id}
                    >
                      <td className="py-2.5 pr-4 align-top">
                        <Link
                          className="font-medium text-[#185fa5]"
                          href={`/dashboard/customers/${customer.id}`}
                        >
                          {customer.name}
                        </Link>
                        <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                          {customer.businessName || "Individual customer"}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 align-top">
                        <p>{customer.phone || "No phone"}</p>
                        <p className="mt-1 text-[10.5px] text-[#94a3b8]">
                          {customer.email || "No email"}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 text-right align-top font-mono font-medium">
                        {money.format(Number(customer.openingBalance))}
                      </td>
                      <td className="py-2.5 pr-4 text-right align-top font-mono">
                        {customer._count.invoices}
                      </td>
                      <td className="py-2.5 pr-4 text-right align-top">
                        <StatusBadge status={customer.status} />
                      </td>
                      <td className="py-2.5 text-right align-top text-muted-foreground">
                        {dateFormatter(customer.createdAt)}
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
