import type { ReactNode } from "react";
import Link from "next/link";

import {
  deleteInvoiceTemplate,
  duplicateInvoiceTemplate,
  setDefaultInvoiceTemplate,
} from "@/app/dashboard/templates/actions";
import { InvoiceTemplateForm } from "@/app/_frontend/components/dashboard/invoice-template-form";
import { requireTemplateManager } from "@/app/_backend/lib/auth/roles";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { parseInvoiceTemplateSettings } from "@/app/_backend/lib/invoice-templates";
import { AppIcon, metricIconForLabel } from "@/app/_frontend/components/dashboard/app-icons";


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
  tone = "neutral",
  value,
}: {
  helper: string;
  label: string;
  tone?: "good" | "neutral" | "warn";
  value: string | number;
}) {
  const toneClasses = {
    good: "bg-[#ecfdf5] text-[#047857]",
    neutral: "bg-[#eef2ff] text-[#4f46e5]",
    warn: "bg-[#fff7ed] text-[#b45309]",
  };
  const toneLineClasses = {
    good: "from-[#00a884] to-[#6ee7b7]",
    neutral: "from-[#635bff] to-[#22d3ee]",
    warn: "from-[#f59e0b] to-[#f97316]",
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

function PremiumVisual() {
  return (
    <div className="premium-visual hidden xl:block" aria-hidden="true">
      <div className="premium-visual-rig">
        <div className="premium-visual-floor" />
        <div className="premium-visual-sheet" />
        <div className="premium-visual-cube" />
        <div className="premium-visual-coin"><AppIcon className="size-5" name="template" /></div>
      </div>
    </div>
  );
}

function ActionLink({
  children,
  href,
  primary = false,
  target,
}: {
  children: ReactNode;
  href: string;
  primary?: boolean;
  target?: string;
}) {
  return (
    <Link
      className={`inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition ${
        primary
          ? "premium-button border-transparent text-white hover:brightness-105"
          : "premium-soft-button hover:border-[#635bff]/30 hover:bg-white"
      }`}
      href={href}
      target={target}
    >
      {children}
    </Link>
  );
}

function ActionButton({
  children,
  danger = false,
  primary = false,
}: {
  children: ReactNode;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      className={`inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition ${
        primary
          ? "premium-button border-transparent text-white hover:brightness-105"
          : danger
            ? "border-[#e24b4a]/30 bg-white/70 text-[#a32d2d] hover:bg-[#fcebeb]"
            : "premium-soft-button hover:border-[#635bff]/30 hover:bg-white"
      }`}
      type="submit"
    >
      {children}
    </button>
  );
}

export default async function InvoiceTemplatesPage() {
  const user = await requireTemplateManager();

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
    <div className="relative grid gap-3.5">
      <PremiumVisual />
      <header className="premium-card relative z-[1] flex flex-col gap-4 overflow-hidden rounded-[16px] border p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#635bff]">
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
        <ActionLink href="/dashboard/invoices" primary>
          Create invoice
        </ActionLink>
      </header>

      <section className="relative z-[1] grid gap-4 md:grid-cols-3">
        <MetricCard
          helper="Reusable layouts available on invoices."
          label="Templates"
          tone="neutral"
          value={templates.length}
        />
        <MetricCard
          helper="Preselected for new draft invoices."
          label="Default template"
          tone={defaultTemplate ? "good" : "warn"}
          value={defaultTemplate?.name ?? "None"}
        />
        <MetricCard
          helper="Historical and current invoice usage."
          label="Template-linked invoices"
          tone="good"
          value={templates.reduce(
            (total, template) => total + template._count.invoices,
            0,
          )}
        />
      </section>

      <section className="relative z-[1] grid items-start gap-3.5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="premium-card rounded-[16px] border p-4">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00a884]">
              New template
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              Build invoice style
            </h3>
          </div>
          <InvoiceTemplateForm />
        </div>

        <div className="premium-card max-h-[780px] overflow-hidden rounded-[16px] border p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635bff]">
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
            <div className="max-h-[640px] divide-y divide-border overflow-y-auto pr-1">
              {parsedTemplates.map((template) => (
                <article
                  className="grid gap-4 p-5 transition hover:bg-white/45"
                  key={template.id}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="text-lg font-semibold text-[#185fa5] hover:underline"
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
                      className="h-12 w-28 rounded-lg border border-white/70 shadow-[0_16px_28px_rgba(30,45,75,0.13)]"
                      style={{
                        background: `linear-gradient(135deg, ${template.settings.accentColor}, rgba(255, 255, 255, 0.7))`,
                      }}
                    >
                      <div className="m-2 h-2 rounded-full bg-white/70" />
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm md:grid-cols-3">
                    <div className="rounded-[10px] border border-white/70 bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
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
                    <div className="rounded-[10px] border border-white/70 bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Invoices
                      </p>
                      <p className="mt-2 font-semibold">
                        {template._count.invoices}
                      </p>
                    </div>
                    <div className="rounded-[10px] border border-white/70 bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
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
                    <ActionLink href={`/dashboard/templates/${template.id}`}>
                      Edit
                    </ActionLink>
                    <ActionLink
                      href={`/dashboard/templates/${template.id}/preview`}
                      target="_blank"
                    >
                      Preview
                    </ActionLink>
                    <form action={duplicateInvoiceTemplate}>
                      <input
                        name="templateId"
                        type="hidden"
                        value={template.id}
                      />
                      <ActionButton>Duplicate</ActionButton>
                    </form>
                    {!template.isDefault ? (
                      <form action={setDefaultInvoiceTemplate}>
                        <input
                          name="templateId"
                          type="hidden"
                          value={template.id}
                        />
                        <ActionButton primary>Set default</ActionButton>
                      </form>
                    ) : null}
                    {template._count.invoices > 0 ? (
                      <span className="inline-flex h-[34px] items-center justify-center rounded-lg border border-white/70 bg-white/55 px-3 text-[11.5px] font-medium text-muted-foreground">
                        In use
                      </span>
                    ) : (
                      <form action={deleteInvoiceTemplate}>
                        <input
                          name="templateId"
                          type="hidden"
                          value={template.id}
                        />
                        <ActionButton danger>Delete</ActionButton>
                      </form>
                    )}
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
