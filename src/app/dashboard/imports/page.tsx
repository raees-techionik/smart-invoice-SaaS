import Link from "next/link";

import { ImportUploadForm } from "@/app/_frontend/components/dashboard/import-upload-form";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { importTypes, readableImportType } from "@/app/_backend/lib/imports";

function dateFormatter(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "imported"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "imported_with_errors"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : status === "reviewed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "needs_review"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : status === "failed"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-border bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex rounded-[5px] border px-2 py-0.5 text-[9.5px] font-medium capitalize ${tone}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
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

const templateLabels: Record<(typeof importTypes)[number], string> = {
  customers: "Customer template",
  expenses: "Expense template",
  inventory: "Inventory template",
  invoices: "Invoice template",
  payments: "Payment template",
  products: "Product template",
};

export default async function ImportsPage() {
  const user = await requireUser();

  const [jobs, totalJobs, needsReviewJobs, reviewedJobs, documentCount] =
    await Promise.all([
      prisma.importJob.findMany({
        include: {
          _count: {
            select: {
              documents: true,
              errors: true,
            },
          },
          createdBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
        where: {
          businessId: user.businessId,
        },
      }),
      prisma.importJob.count({
        where: {
          businessId: user.businessId,
        },
      }),
      prisma.importJob.count({
        where: {
          businessId: user.businessId,
          status: "needs_review",
        },
      }),
      prisma.importJob.count({
        where: {
          businessId: user.businessId,
          status: "reviewed",
        },
      }),
      prisma.importedDocument.count({
        where: {
          businessId: user.businessId,
        },
      }),
    ]);

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            OCR and imports
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Import review workflow
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Upload customer, product, invoice, expense, payment, and inventory
            stock source files, create import jobs, review extracted fields, and
            prepare mapping before records are written into the live business
            tables.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          helper="Import jobs created so far."
          label="Jobs"
          value={totalJobs}
        />
        <MetricCard
          helper="Jobs waiting for manual correction."
          label="Needs review"
          value={needsReviewJobs}
        />
        <MetricCard
          helper="Jobs marked reviewed."
          label="Reviewed"
          value={reviewedJobs}
        />
        <MetricCard
          helper="Stored source documents."
          label="Documents"
          value={documentCount}
        />
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-[14px] border border-border bg-white p-4">
          <div className="mb-5">
            <p className="text-sm font-medium text-muted-foreground">
              New import
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Upload source file</h3>
          </div>
          <ImportUploadForm />
          <div className="mt-6 rounded-[10px] border border-dashed border-border bg-[#f8f9fa] p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Excel templates
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {importTypes.map((importType) => (
                <Link
                  className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
                  href={`/dashboard/imports/templates/${importType}`}
                  key={importType}
                >
                  {templateLabels[importType]}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Import history
              </p>
              <h3 className="mt-1 text-[13px] font-medium">Recent jobs</h3>
            </div>
            <span className="text-sm text-muted-foreground">
              Showing {jobs.length} jobs
            </span>
          </div>

          {jobs.length === 0 ? (
            <div className="grid min-h-64 place-items-center p-8 text-center">
              <div>
                <p className="text-lg font-semibold">No import jobs yet</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Upload a file to create the first review workspace.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="text-[11px] text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Job</th>
                    <th className="px-5 py-3 font-semibold">Target</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Progress</th>
                    <th className="px-5 py-3 font-semibold">Owner</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map((job) => (
                    <tr className="transition hover:bg-[#e6f1fb]/40" key={job.id}>
                      <td className="px-5 py-4 align-top">
                        <Link
                          className="font-semibold text-accent hover:underline"
                          href={`/dashboard/imports/${job.id}`}
                        >
                          {job.fileName}
                        </Link>
                        <p className="mt-1 text-muted-foreground">
                          {job._count.documents} document / {job._count.errors}{" "}
                          errors
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top capitalize">
                        {readableImportType(job.importType)}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold">
                          {job.status.startsWith("imported") ||
                          job.status === "failed"
                            ? `${job.successfulRows} created / ${job.totalRows} records`
                            : `${job.successfulRows} reviewed / ${job.totalRows} fields`}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {job.status.startsWith("imported") ||
                          job.status === "failed"
                            ? `${job.failedRows} failed records`
                            : `${job.failedRows} still needs review`}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {job.createdBy?.name ?? "System"}
                      </td>
                      <td className="px-5 py-4 align-top text-muted-foreground">
                        {dateFormatter(job.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
