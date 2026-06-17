import Link from "next/link";

import {
  deleteInvoiceTemplate,
  setDefaultInvoiceTemplate,
} from "@/app/dashboard/templates/actions";
import { InvoiceTemplateForm } from "@/app/_frontend/components/dashboard/invoice-template-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { parseInvoiceTemplateSettings } from "@/app/_backend/lib/invoice-templates";

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
  value,
}: {
  helper: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-white p-[15px]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-[21px] font-medium leading-none">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

function DefaultBadge({ isDefault }: { isDefault: boolean }) {
  if (isDefault) {
    return (
      <span className="inline-flex rounded-[5px] border border-[#185fa5]/20 bg-[#e6f1fb] px-2 py-0.5 text-[9.5px] font-medium text-[#185fa5]">
        Default
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-[5px] border border-border bg-[#f8f9fa] px-2 py-0.5 text-[9.5px] font-medium text-muted-foreground">
      Optional
    </span>
  );
}

export default async function InvoiceTemplatesPage() {
  const user = await requireUser();

  const templates = await prisma.invoiceTemplate.findMany({
    include: {
      _count: {
        select: {
          invoices: true,
        },
      },
    },
    orderBy: [
      {
        isDefault: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
    where: {
      businessId: user.businessId,
    },
  });

  const defaultTemplate = templates.find((template) => template.isDefault);
  const parsedTemplates = templates.map((template) => ({
    ...template,
    settings: parseInvoiceTemplateSettings(template.settings),
  }));

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Invoice templates
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Reusable invoice layouts
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Create reusable invoice layouts with default notes, terms, payment
            instructions, branding visibility, and color choices.
          </p>
        </div>
        <Link
          className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
          href="/dashboard/invoices"
        >
          Create invoice
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          helper="Reusable layouts available on invoices."
          label="Templates"
          value={templates.length}
        />
        <MetricCard
          helper="Preselected for new draft invoices."
          label="Default template"
          value={defaultTemplate?.name ?? "None"}
        />
        <MetricCard
          helper="Historical and current invoice usage."
          label="Template-linked invoices"
          value={templates.reduce(
            (total, template) => total + template._count.invoices,
            0,
          )}
        />
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-[14px] border border-border bg-white p-4">
          <div className="mb-5">
            <p className="text-sm font-medium text-muted-foreground">
              New template
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              Build invoice style
            </h3>
          </div>
          <InvoiceTemplateForm />
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Template library
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Saved invoice layouts
              </h3>
            </div>
            <span className="text-sm text-muted-foreground">
              {templates.length} records
            </span>
          </div>

          {parsedTemplates.length === 0 ? (
            <div className="grid min-h-64 place-items-center p-8 text-center">
              <div>
                <p className="text-lg font-semibold">No templates yet</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Create one template to make invoice drafting more consistent.
                  The first template is automatically marked as default.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {parsedTemplates.map((template) => (
                <article className="grid gap-4 p-5" key={template.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="text-lg font-semibold text-accent hover:underline"
                          href={`/dashboard/templates/${template.id}`}
                        >
                          {template.name}
                        </Link>
                        <DefaultBadge isDefault={template.isDefault} />
                      </div>
                      <p className="mt-2 text-sm capitalize text-muted-foreground">
                        {template.settings.layout} layout /{" "}
                        {template.settings.headerStyle} header /{" "}
                        {template.settings.density} lines / updated{" "}
                        {dateFormatter(template.updatedAt)}
                      </p>
                    </div>
                    <div
                      className="h-12 w-28 rounded-lg border border-border"
                      style={{ backgroundColor: template.settings.accentColor }}
                    />
                  </div>

                  <div className="grid gap-3 text-sm md:grid-cols-3">
                    <div className="rounded-[10px] border border-border bg-[#f8f9fa] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Branding
                      </p>
                      <p className="mt-2 font-semibold">
                        {[
                          template.settings.showLogo
                            ? `logo ${template.settings.logoPlacement}`
                            : null,
                          template.settings.showSignature
                            ? `signature ${template.settings.signaturePlacement}`
                            : null,
                          template.settings.showStamp
                            ? `stamp ${template.settings.stampPlacement}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(", ") || "none"}
                      </p>
                    </div>
                    <div className="rounded-[10px] border border-border bg-[#f8f9fa] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Invoices
                      </p>
                      <p className="mt-2 font-semibold">
                        {template._count.invoices}
                      </p>
                    </div>
                    <div className="rounded-[10px] border border-border bg-[#f8f9fa] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Defaults
                      </p>
                      <p className="mt-2 font-semibold">
                        {template.settings.defaultTerms ||
                        template.settings.defaultNotes ||
                        template.settings.paymentInstructions ||
                        template.settings.footerText
                          ? "Copy defaults set"
                          : "No text defaults"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
                      href={`/dashboard/templates/${template.id}`}
                    >
                      Edit
                    </Link>
                    {!template.isDefault ? (
                      <form action={setDefaultInvoiceTemplate}>
                        <input
                          name="templateId"
                          type="hidden"
                          value={template.id}
                        />
                        <button
                          className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
                          type="submit"
                        >
                          Set default
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteInvoiceTemplate}>
                      <input
                        name="templateId"
                        type="hidden"
                        value={template.id}
                      />
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                        type="submit"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
