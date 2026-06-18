"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pageLabels = [
  { match: "/dashboard/invoices", title: "Invoices", sub: "Create, review, and finalize billing" },
  { match: "/dashboard/customers", title: "Customers", sub: "Customer records and receivables" },
  { match: "/dashboard/products", title: "Products", sub: "Catalog and service setup" },
  { match: "/dashboard/inventory", title: "Inventory", sub: "Stock movements and alerts" },
  { match: "/dashboard/payments", title: "Payments", sub: "Collections and payment history" },
  { match: "/dashboard/expenses", title: "Expenses", sub: "Business costs and receipts" },
  { match: "/dashboard/reports", title: "Reports", sub: "Performance and operational reports" },
  { match: "/dashboard/imports", title: "Smart import", sub: "OCR and spreadsheet review" },
  { match: "/dashboard/pos", title: "POS lite", sub: "Quick counter billing" },
  { match: "/dashboard/settings", title: "Settings", sub: "Business profile and preferences" },
  { match: "/dashboard/templates", title: "Templates", sub: "Reusable invoice layouts" },
];

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SB"
  );
}

function todayLabel() {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
  }).format(new Date());
}

function pageTitle(pathname: string) {
  if (pathname === "/dashboard") {
    return { title: "Dashboard", sub: todayLabel() };
  }

  if (/^\/dashboard\/invoices\/[^/]+$/.test(pathname)) {
    return { title: "Invoice Detail", sub: todayLabel() };
  }

  return (
    pageLabels.find((page) => pathname.startsWith(page.match)) ?? {
      title: "Workspace",
      sub: todayLabel(),
    }
  );
}

export function DashboardTopbar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const page = pageTitle(pathname);

  return (
    <header className="premium-topbar sticky top-0 z-10 hidden h-[54px] items-center justify-between border-b px-[22px] print:hidden lg:flex">
      <div>
        <h2 className="text-[14.5px] font-medium">{page.title}</h2>
        <p className="mt-0.5 text-[11px] text-[#94a3b8]">{page.sub}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative w-[190px]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94a3b8]">
            Search
          </span>
          <input
            className="premium-soft-button h-[31px] w-full rounded-lg border pl-[58px] pr-3 text-xs outline-none transition focus:border-accent focus:bg-white"
            placeholder="..."
          />
        </div>
        <span className="premium-soft-button relative grid size-[30px] place-items-center rounded-lg border text-xs text-muted-foreground">
          N
          <span className="absolute right-1 top-1 size-[5px] rounded-full bg-danger ring-2 ring-white" />
        </span>
        <span className="premium-soft-button grid size-[30px] place-items-center rounded-lg border text-xs text-muted-foreground">
          R
        </span>
        <span className="premium-avatar grid size-[30px] place-items-center rounded-full text-[11px] font-semibold text-white">
          {initials(userName)}
        </span>
        <Link
          className="premium-button inline-flex h-[31px] items-center justify-center rounded-lg px-3.5 text-[12.5px] font-medium text-white transition hover:brightness-105"
          href="/dashboard/invoices"
        >
          + New invoice
        </Link>
      </div>
    </header>
  );
}
