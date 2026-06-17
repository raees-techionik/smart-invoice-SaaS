import { redirect } from "next/navigation";

import {
  LoginOwnerForm,
  RegisterOwnerForm,
} from "@/app/_frontend/components/forms/auth-forms";
import { getCurrentSession, getPostLoginPath } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{value}</p>
    </div>
  );
}

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect(getPostLoginPath(session.user.business.isProfileComplete));
  }

  const hasOwner = (await prisma.user.count()) > 0;

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f7f1] text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(16,185,129,0.18),transparent_30%),radial-gradient(circle_at_86%_12%,rgba(15,23,42,0.10),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.72),rgba(236,253,245,0.35))]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1500px] gap-8 px-5 py-5 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-8">
        <section className="relative hidden min-h-[calc(100vh-64px)] overflow-hidden rounded-[40px] bg-slate-950 p-8 text-white shadow-[0_40px_120px_rgba(15,23,42,0.25)] lg:flex lg:flex-col">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(52,211,153,0.35),transparent_28%),radial-gradient(circle_at_78%_10%,rgba(16,185,129,0.24),transparent_24%),linear-gradient(150deg,rgba(255,255,255,0.10),transparent_42%)]" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-emerald-400 text-sm font-black text-emerald-950 shadow-xl shadow-emerald-400/20">
                SB
              </div>
              <div>
                <p className="text-xl font-semibold tracking-[-0.04em]">
                  Smart Business
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/70">
                  Local command suite
                </p>
              </div>
            </div>
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
              Private beta
            </span>
          </div>

          <div className="relative my-auto max-w-3xl py-16">
            <p className="w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">
              Invoices / Inventory / Cashflow
            </p>
            <h1 className="mt-7 text-6xl font-semibold tracking-[-0.07em] text-white xl:text-7xl">
              A premium control room for everyday business operations.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/62">
              Manage invoices, customers, products, stock movement, payments,
              and local business records from one fast owner workspace.
            </p>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              <MiniMetric label="Mode" value="Local" />
              <MiniMetric label="Core" value="Invoices" />
              <MiniMetric label="Stock" value="Live" />
            </div>
          </div>

          <div className="relative grid gap-3 rounded-[32px] border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold">Today&apos;s workspace</p>
              <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-bold text-emerald-950">
                Ready
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {["Draft invoice", "Stock warning", "Payment posted"].map(
                (item) => (
                  <div
                    className="rounded-2xl bg-slate-950/45 p-4 text-sm text-white/70"
                    key={item}
                  >
                    <span className="block font-semibold text-white">
                      {item}
                    </span>
                    <span className="mt-1 block">Synced locally</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-40px)] items-center justify-center lg:min-h-[calc(100vh-64px)]">
          <div className="w-full max-w-xl">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-emerald-800 text-sm font-black text-white">
                  SB
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-[-0.04em]">
                    Smart Business
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Local command suite
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[36px] border border-white/80 bg-white/78 p-5 shadow-[0_35px_100px_rgba(15,23,42,0.12)] backdrop-blur-xl md:p-8">
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
                  Owner access
                </p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.06em] md:text-5xl">
                  Sign in to your business OS.
                </h2>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  Continue into the current local workspace. This build is
                  running on your machine and connected to the local database.
                </p>

                <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
                    Local demo credentials
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-950">
                        Email:
                      </span>{" "}
                      owner@example.com
                    </p>
                    <p>
                      <span className="font-semibold text-slate-950">
                        Password:
                      </span>{" "}
                      password123
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <LoginOwnerForm />
                </div>
              </div>

              <div className="mt-4 rounded-[28px] border border-slate-100 bg-slate-950 p-5 text-white">
                {hasOwner ? (
                  <div>
                    <p className="text-sm font-semibold">
                      Owner account exists
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      Sign in with the local owner credentials above. New owner
                      registration is locked once the first account exists.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold">Create first owner</p>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      No owner account exists yet. Create the first local owner
                      to unlock setup.
                    </p>
                    <div className="mt-5 rounded-3xl bg-white p-5 text-slate-950">
                      <RegisterOwnerForm />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
