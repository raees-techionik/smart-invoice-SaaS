import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteInvoiceTemplate,
  setDefaultInvoiceTemplate,
} from "@/app/dashboard/templates/actions";
import { InvoiceTemplateForm } from "@/app/_frontend/components/dashboard/invoice-template-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { parseInvoiceTemplateSettings } from "@/app/_backend/lib/invoice-templates";

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
    <div className="flex justify-between gap-4 border-b border-border pb-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

export default async function InvoiceTemplateDetailPage({
  params,
}: InvoiceTemplateDetailPageProps) {
  const user = await requireUser();
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
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
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
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/templates"
          >
            Back to templates
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href={`/dashboard/templates/${template.id}/preview`}
            target="_blank"
          >
            Preview PDF
          </Link>
          {!template.isDefault ? (
            <form action={setDefaultInvoiceTemplate}>
              <input name="templateId" type="hidden" value={template.id} />
              <button
                className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
                type="submit"
              >
                Set default
              </button>
            </form>
          ) : null}
          <form action={deleteInvoiceTemplate}>
            <input name="templateId" type="hidden" value={template.id} />
            <button
              className="inline-flex h-[34px] items-center justify-center rounded-lg border border-[#e24b4a]/30 bg-white px-3 text-[11.5px] font-medium text-[#a32d2d] transition hover:bg-[#fcebeb]"
              type="submit"
            >
              Delete template
            </button>
          </form>
        </div>
      </header>

      <section className="grid gap-3.5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[14px] border border-border bg-white p-4">
          <div className="mb-5">
            <p className="text-sm font-medium text-muted-foreground">
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
          <div className="rounded-[14px] border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">
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

          <div className="rounded-[14px] border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Template preview
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background">
              <div
                className="h-2"
                style={{ backgroundColor: settings.accentColor }}
              />
              <div
                className={`grid gap-5 p-5 ${
                  settings.density === "compact" ? "text-sm" : ""
                }`}
              >
                <div
                  className={`flex items-start justify-between gap-4 border-b border-border pb-4 ${
                    settings.headerStyle === "boxed"
                      ? "rounded-[10px] border border-border bg-white p-4"
                      : ""
                  }`}
                >
                  {settings.showLogo && settings.logoPlacement === "left" ? (
                    <div className="grid size-14 place-items-center rounded-lg border border-border bg-[#f8f9fa] text-xs font-semibold text-muted-foreground">
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
                    <div className="grid size-14 place-items-center rounded-lg border border-border bg-[#f8f9fa] text-xs font-semibold text-muted-foreground">
                      Logo
                    </div>
                  ) : null}
                </div>
                <div
                  className={
                    settings.layout === "modern"
                      ? "grid gap-3 md:grid-cols-2"
                      : "grid gap-3"
                  }
                >
                  <div className="rounded-[10px] bg-[#f8f9fa] p-3">
                    <p className="text-xs text-muted-foreground">Bill to</p>
                    <p className="mt-1 font-semibold">Customer Name</p>
                    {settings.showCustomerContacts ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Phone and email visible
                      </p>
                    ) : null}
                  </div>
                  {settings.showBalanceBox ? (
                    <div className="rounded-[10px] bg-[#f8f9fa] p-3">
                      <p className="text-xs text-muted-foreground">Amount due</p>
                      <p className="mt-1 font-semibold">PKR 0.00</p>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-lg border border-border">
                  <div className="grid grid-cols-3 gap-3 border-b border-border bg-muted/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 px-3 py-3 text-sm">
                    <span>
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
                  <div className="rounded-[10px] bg-[#f8f9fa] p-3 text-sm text-muted-foreground">
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
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                  {settings.showSignature ? (
                    <span>
                      Signature {settings.signaturePlacement} /{" "}
                      {settings.signatureLabel}
                    </span>
                  ) : null}
                  {settings.showStamp ? (
                    <span>Stamp {settings.stampPlacement}</span>
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
