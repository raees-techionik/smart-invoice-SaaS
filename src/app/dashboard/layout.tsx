import { redirect } from "next/navigation";

import { DashboardNav } from "@/app/_frontend/components/dashboard/dashboard-nav";
import { DashboardTopbar } from "@/app/_frontend/components/dashboard/dashboard-topbar";
import { AppIcon } from "@/app/_frontend/components/dashboard/app-icons";
import { LogoutButton } from "@/app/_frontend/components/forms/logout-button";
import { requireUser } from "@/app/_backend/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();

  if (!user.business.isProfileComplete) {
    redirect("/setup");
  }

  return (
    <div className="premium-app-bg min-h-screen bg-background">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        <aside className="premium-sidebar border-b border-white/10 text-white print:hidden lg:sticky lg:top-0 lg:h-screen lg:w-[196px] lg:shrink-0 lg:border-b-0">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-3.5 py-4 lg:grid lg:gap-1">
            <div className="flex items-center gap-3">
              <div className="premium-avatar grid size-7 place-items-center rounded-[7px] text-[11px] font-semibold text-white">
                SI
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[13.5px] font-medium">
                  Smart Invoice
                </h1>
                <p className="mt-0.5 truncate text-[10px] text-white/30">
                  {user.business.category || "Management Suite"}
                </p>
              </div>
            </div>
            <div className="md:hidden">
              <LogoutButton />
            </div>
          </div>
          <DashboardNav role={user.role} />
          <div className="mt-auto hidden border-t border-white/[0.06] px-2 py-3 lg:block">
            <div className="flex items-center gap-2 rounded-[9px] border border-white/[0.07] bg-white/[0.04] px-2 py-2 transition hover:bg-white/[0.07]">
              <div className="premium-avatar grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white">
                <AppIcon className="size-3.5" name="user" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] text-white/70">{user.name}</p>
                <p className="truncate text-[10px] capitalize text-white/30">
                  {user.role}
                </p>
              </div>
            </div>
            <div className="px-2 pt-2">
              <div className="mt-4">
                <LogoutButton />
              </div>
            </div>
          </div>
        </aside>
        <div className="premium-shell min-w-0 flex-1">
          <DashboardTopbar />
          <main className="px-[22px] py-5 print:p-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
