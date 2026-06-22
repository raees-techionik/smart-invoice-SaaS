"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppIcon } from "@/app/_frontend/components/dashboard/app-icons";

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

export function DashboardTopbar() {
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
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]">
            <AppIcon className="size-3.5" name="search" />
          </span>
          <input
            className="premium-soft-button h-[31px] w-full rounded-lg border pl-8 pr-3 text-xs outline-none transition focus:border-accent focus:bg-white"
            placeholder="Search"
          />
        </div>
        <Link
          className="premium-button inline-flex h-[31px] items-center justify-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-medium text-white transition hover:brightness-105"
          href="/dashboard/invoices"
        >
          <AppIcon className="size-3.5" name="plus" />
          New invoice
        </Link>
      </div>
    </header>
  );
}
