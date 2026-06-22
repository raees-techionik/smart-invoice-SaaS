import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceEmailForm } from "@/app/_frontend/components/dashboard/invoice-email-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { buildInvoiceEmailContent } from "@/app/_backend/lib/invoice-email";

type SendInvoicePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function dateFormatter(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusTone(status: string) {
  if (status === "sent") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "sending") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default async function SendInvoicePage({
  params,
}: SendInvoicePageProps) {
  const user = await requireUser();
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    include: {
      business: true,
      customer: true,
      emailSends: {
        include: {
          createdBy: {
            select: {
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          preparedAt: "desc",
        },
        take: 5,
      },
      items: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      template: true,
    },
    where: {
      businessId: user.businessId,
      id,
    },
  });

  if (!invoice) {
    notFound();
  }

  const emailContent = buildInvoiceEmailContent(
    invoice,
    user.business.currency,
  );

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Send invoice
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            {invoice.invoiceNumber}
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Prepare the recipient, subject, and message body for this invoice.
            Copy this draft into your email app and attach the invoice PDF from
            the preview/download links.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href={`/dashboard/invoices/${invoice.id}`}
          >
            Back to invoice
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href={`/dashboard/invoices/${invoice.id}/pdf`}
            rel="noreferrer"
            target="_blank"
          >
            Preview PDF
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href={`/dashboard/invoices/${invoice.id}/pdf?download=1`}
          >
            Download PDF
          </Link>
        </div>
      </header>

      <section className="grid gap-3.5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="mb-5">
            <p className="text-sm font-medium text-muted-foreground">
              Email content
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              Review before sending
            </h3>
          </div>
          <InvoiceEmailForm
            defaultBody={emailContent.body}
            defaultRecipientEmail={invoice.customer?.email ?? ""}
            defaultSubject={emailContent.subject}
            invoiceId={invoice.id}
          />
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-blue-800">
            <p className="text-sm font-semibold">Manual email draft</p>
            <p className="mt-2 text-sm leading-6">
              Automatic sending is disabled for the local-first MVP. Use this
              page to prepare copy-ready content, then send it from your normal
              email app with the downloaded invoice PDF attached.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted-foreground">
              Invoice context
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="text-right font-semibold">
                  {invoice.customer?.businessName ||
                    invoice.customer?.name ||
                    "No customer"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Customer email</dt>
                <dd className="text-right font-semibold">
                  {invoice.customer?.email || "Not set"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-semibold capitalize">{invoice.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Invoice date</dt>
                <dd className="font-semibold">
                  {dateFormatter(invoice.invoiceDate)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Due date</dt>
                <dd className="font-semibold">
                  {dateFormatter(invoice.dueDate)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-white">
            <div className="border-b border-border p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Recent preparations
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Send-ready history
              </h3>
            </div>
            {invoice.emailSends.length === 0 ? (
              <div className="p-5 text-sm leading-6 text-muted-foreground">
                No email has been prepared for this invoice yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {invoice.emailSends.map((emailSend) => (
                  <div className="grid gap-2 p-5" key={emailSend.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        {emailSend.recipientEmail}
                      </p>
                      <span
                        className={`rounded-[5px] border px-2 py-0.5 text-[9.5px] font-medium capitalize ${statusTone(
                          emailSend.status,
                        )}`}
                      >
                        {emailSend.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {emailSend.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Prepared {dateFormatter(emailSend.preparedAt)} by{" "}
                      {emailSend.createdBy?.name ||
                        emailSend.createdBy?.email ||
                        "Unknown user"}
                    </p>
                    {emailSend.errorMessage ? (
                      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                        {emailSend.errorMessage}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
