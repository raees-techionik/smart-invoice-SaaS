import { redirect } from "next/navigation";

import { BusinessProfileForm } from "@/app/_frontend/components/forms/business-profile-form";
import { LogoutButton } from "@/app/_frontend/components/forms/logout-button";
import { requireUser } from "@/app/_backend/lib/auth/session";

export default async function SetupPage() {
  const user = await requireUser();

  if (user.business.isProfileComplete) {
    redirect("/dashboard");
  }

  const business = user.business;

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">
              Business setup
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Complete your business profile
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              These settings will drive invoice numbering, default invoice text,
              reports, and future templates.
            </p>
          </div>
          <LogoutButton />
        </header>

        <section className="rounded-lg border border-border bg-white p-5">
          <BusinessProfileForm
            defaults={{
              name: business.name === "Untitled business" ? "" : business.name,
              ownerName: business.ownerName ?? user.name,
              phone: business.phone ?? "",
              email: business.email ?? user.email,
              address: business.address ?? "",
              taxNumber: business.taxNumber ?? "",
              currency: business.currency,
              category: business.category ?? "",
              invoicePrefix: business.invoicePrefix,
              defaultTerms: business.defaultTerms ?? "",
              defaultNotes: business.defaultNotes ?? "",
            }}
          />
        </section>
      </div>
    </main>
  );
}
