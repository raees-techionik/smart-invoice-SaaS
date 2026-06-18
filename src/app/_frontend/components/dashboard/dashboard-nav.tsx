"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  canManageSettings,
  canViewReports,
} from "@/app/_backend/lib/auth/role-utils";
import { cn } from "@/app/_backend/lib/utils";

const navItems = [
  { href: "/dashboard", icon: "DB", label: "Dashboard", status: "Live" },
  { href: "/dashboard/invoices", icon: "IV", label: "Invoices", status: "Live" },
  { href: "/dashboard/invoices", icon: "+", label: "New invoice", status: "Live" },
  { href: "/dashboard/customers", icon: "CU", label: "Customers", status: "Live" },
  { href: "/dashboard/products", icon: "BX", label: "Products", status: "Live" },
  { href: "/dashboard/inventory", icon: "PK", label: "Inventory", status: "Live" },
  { section: "Finance", href: "", icon: "", label: "", status: "Soon" },
  { href: "/dashboard/payments", icon: "PY", label: "Payments", status: "Live" },
  { href: "/dashboard/expenses", icon: "EX", label: "Expenses", status: "Live" },
  { href: "/dashboard/reports", icon: "RP", label: "Reports", status: "Live" },
  { section: "Tools", href: "", icon: "", label: "", status: "Soon" },
  { href: "/dashboard/imports", icon: "SC", label: "Smart import", status: "Live" },
  { href: "/dashboard/pos", icon: "PS", label: "POS", status: "Live" },
  { href: "/dashboard/settings", icon: "SE", label: "Settings", status: "Live" },
] as const;

export function DashboardNav({ role }: { role: string }) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter(
    (item) =>
      "section" in item ||
      ((item.href !== "/dashboard/settings" || canManageSettings(role)) &&
        (item.href !== "/dashboard/reports" || canViewReports(role))),
  );

  return (
    <nav className="flex gap-2 overflow-x-auto px-2 py-2.5 lg:grid lg:gap-1 lg:overflow-visible">
      {visibleNavItems.map((item) => {
        if ("section" in item) {
          return (
            <p
              className="px-2 pb-1 pt-2 text-[9px] uppercase tracking-[0.1em] text-white/25"
              key={item.section}
            >
              {item.section}
            </p>
          );
        }

        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            item.label !== "New invoice" &&
            pathname.startsWith(item.href));

        return (
          <Link
            className={cn(
              "flex min-w-max items-center justify-between gap-2 rounded-[9px] px-2 py-[8px] text-[12.5px] font-medium transition",
              isActive
                ? "bg-gradient-to-r from-[#635bff]/25 to-[#14b8a6]/10 text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
                : "text-white/48 hover:bg-white/[0.06] hover:text-white/85",
            )}
            href={item.href}
            key={`${item.href}-${item.label}`}
          >
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-[7px] text-[9px] font-semibold",
                  isActive
                    ? "bg-white/10 text-white"
                    : "bg-white/[0.06] text-white/55",
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
