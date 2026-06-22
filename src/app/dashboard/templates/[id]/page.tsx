import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteInvoiceTemplate,
  duplicateInvoiceTemplate,
  setDefaultInvoiceTemplate,
} from "@/app/dashboard/templates/actions";
import { InvoiceTemplateForm } from "@/app/_frontend/components/dashboard/invoice-template-form";
import { requireTemplateManager } from "@/app/_backend/lib/auth/roles";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { parseInvoiceTemplateSettings } from "@/app/_backend/lib/invoice-templates";
import { AppIcon } from "@/app/_frontend/components/dashboard/app-icons";


type InvoiceTemplateDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function dateFormatter(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-4 rounded-lg border border-white/70 bg-white/55 px-3 py-2.5 shadow-[0_8px_18px_rgba(36,42,94,0.05)]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
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

export default async function InvoiceTemplateDetailPage({
  params,
}: InvoiceTemplateDetailPageProps) {
  const user = await requireTemplateManager();
  const { id } = await params;

  const template = await prisma.invoiceTemplate.findFirst({
    include: {
      _count: {
        select: {
          invoices: true,
        },
      },
    },
    where: {
      businessId: user.businessId,
      id,
    },
  });

  if (!template) {
    notFound();
  }

  const settings = parseInvoiceTemplateSettings(template.settings);

  return (
    <div className="relative grid gap-3.5">
      <PremiumVisual />
      <header className="premium-card relative z-[1] flex flex-col gap-4 overflow-hidden rounded-[16px] border p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#635bff]">
            Invoice template
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            {template.name}
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Update reusable invoice defaults and branding controls. New drafts
            can select this template from the invoice workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionLink href="/dashboard/templates">
            Back to templates
          </ActionLink>
          <ActionLink
            href={`/dashboard/templates/${template.id}/preview`}
            primary
            target="_blank"
          >
            Preview PDF
          </ActionLink>
          <form action={duplicateInvoiceTemplate}>
            <input name="templateId" type="hidden" value={template.id} />
            <ActionButton>Duplicate</ActionButton>
          </form>
          {!template.isDefault ? (
            <form action={setDefaultInvoiceTemplate}>
              <input name="templateId" type="hidden" value={template.id} />
              <ActionButton primary>Set default</ActionButton>
            </form>
          ) : null}
          {template._count.invoices > 0 ? (
            <span className="inline-flex h-[34px] items-center justify-center rounded-lg border border-white/70 bg-white/55 px-3 text-[11.5px] font-medium text-muted-foreground">
              In use by invoices
            </span>
          ) : (
            <form action={deleteInvoiceTemplate}>
              <input name="templateId" type="hidden" value={template.id} />
              <ActionButton danger>Delete template</ActionButton>
            </form>
          )}
        </div>
      </header>

      <section className="relative z-[1] grid gap-3.5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="premium-card rounded-[16px] border p-4">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00a884]">
              Edit template
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Layout settings</h3>
          </div>
          <InvoiceTemplateForm
            defaults={{
              id: template.id,
              isDefault: template.isDefault,
              name: template.name,
              settings,
            }}
            submitLabel="Update template"
          />
        </div>

        <div className="grid content-start gap-6">
          <div className="premium-card rounded-[16px] border p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635bff]">
              Template metadata
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <DetailRow
                label="Default"
                value={template.isDefault ? "Yes" : "No"}
              />
              <DetailRow
                label="Invoices"
                value={String(template._count.invoices)}
              />
              <DetailRow
                label="Created"
                value={dateFormatter(template.createdAt)}
              />
              <DetailRow
                label="Updated"
                value={dateFormatter(template.updatedAt)}
              />
            </dl>
          </div>

          <div className="premium-card rounded-[16px] border p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f59e0b]">
              Template preview
            </p>
            <div className="mt-4 overflow-hidden rounded-[18px] border border-white/70 bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
              <div
                className={`overflow-hidden rounded-[14px] border border-white/80 bg-gradient-to-br from-white to-[#edf5ff] shadow-[0_22px_48px_rgba(30,45,75,0.13)] ${
                  settings.density === "compact" ? "text-sm" : ""
                }`}
              >
                <div
                  className="h-2"
                  style={{
                    background: `linear-gradient(90deg, ${settings.accentColor}, #22d3ee)`,
                  }}
                />
                <div
                  className={`m-5 flex items-start justify-between gap-4 border-b border-border pb-4 ${
                    settings.headerStyle === "boxed"
                      ? "rounded-[12px] border border-white/80 bg-white/70 p-4 shadow-[0_14px_28px_rgba(36,42,94,0.06)]"
                      : ""
                  }`}
                >
                  {settings.showLogo && settings.logoPlacement === "left" ? (
                    <div className="grid size-14 place-items-center rounded-lg border border-white/80 bg-white/70 text-xs font-semibold text-muted-foreground shadow-[0_10px_20px_rgba(36,42,94,0.08)]">
                      Logo
                    </div>
                  ) : null}
                  <div>
                    <p
                      className="text-xs font-semibold uppercase tracking-[0.18em]"
                      style={{ color: settings.accentColor }}
                    >
                      {user.business.name}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold">Invoice</h3>
                    {settings.showBusinessTaxNumber ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Tax number visible
                      </p>
                    ) : null}
                  </div>
                  {settings.showLogo && settings.logoPlacement === "right" ? (
                    <div className="grid size-14 place-items-center rounded-lg border border-white/80 bg-white/70 text-xs font-semibold text-muted-foreground shadow-[0_10px_20px_rgba(36,42,94,0.08)]">
                      Logo
                    </div>
                  ) : null}
                </div>
                <div
                  className={`mx-5 ${
                    settings.layout === "modern"
                      ? "grid gap-3 md:grid-cols-2"
                      : "grid gap-3"
                  }`}
                >
                  <div className="rounded-[12px] border border-white/70 bg-white/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <p className="text-xs text-muted-foreground">Bill to</p>
                    <p className="mt-1 font-semibold">Customer Name</p>
                    {settings.showCustomerContacts ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Phone and email visible
                      </p>
                    ) : null}
                  </div>
                  {settings.showBalanceBox ? (
                    <div className="rounded-[12px] border border-white/70 bg-white/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <p className="text-xs text-muted-foreground">Amount due</p>
                      <p className="mt-1 font-semibold">PKR 0.00</p>
                    </div>
                  ) : null}
                </div>
                <div className="mx-5 mt-5 min-w-0 rounded-lg border border-white/80 bg-white/50">
                  <div className="grid grid-cols-[minmax(0,1fr)_44px_76px] gap-3 border-b border-border bg-white/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_44px_76px] gap-3 px-3 py-3 text-sm">
                    <span className="min-w-0 break-words">
                      Service or product
                      {settings.showItemDescriptions ? (
                        <span className="block text-xs text-muted-foreground">
                          Description visible
                        </span>
                      ) : null}
                    </span>
                    <span className="text-right">1</span>
                    <span className="text-right font-semibold">PKR 0.00</span>
                  </div>
                </div>
                {settings.defaultTerms ||
                settings.defaultNotes ||
                settings.paymentInstructions ||
                settings.footerText ? (
                  <div className="mx-5 mt-5 rounded-[12px] border border-white/70 bg-white/60 p-3 text-sm text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <p className="font-semibold text-foreground">
                      Default copy
                    </p>
                    <p className="mt-1">
                      {settings.defaultTerms ||
                        settings.paymentInstructions ||
                        settings.defaultNotes ||
                        settings.footerText ||
                        "Template text"}
                    </p>
                  </div>
                ) : null}
                <div className="m-5 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                  {settings.showSignature ? (
                    <span className="rounded-full border border-white/70 bg-white/60 px-3 py-1">
                      Signature {settings.signaturePlacement} /{" "}
                      {settings.signatureLabel}
                    </span>
                  ) : null}
                  {settings.showStamp ? (
                    <span className="rounded-full border border-white/70 bg-white/60 px-3 py-1">
                      Stamp {settings.stampPlacement}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
