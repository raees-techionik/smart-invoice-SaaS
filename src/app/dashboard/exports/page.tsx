import Link from "next/link";

import { BackupRestoreForm } from "@/app/_frontend/components/dashboard/backup-restore-form";
import { requireDataExporter } from "@/app/_backend/lib/auth/roles";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { getExportSummaries } from "@/app/_backend/lib/exports";

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

function dateTimeFormatter(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function reportLabel(reportName: string) {
  return reportName
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function filterSummary(filtersJson: string | null) {
  if (!filtersJson) {
    return "No filters";
  }

  try {
    const filters = JSON.parse(filtersJson) as Record<string, string | null>;
    const activeFilters = Object.entries(filters)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`);

    return activeFilters.length > 0 ? activeFilters.join(" / ") : "No filters";
  } catch {
    return "Filters unavailable";
  }
}

export default async function ExportsPage() {
  const user = await requireDataExporter();
  const [summaries, recentExportLogs] = await Promise.all([
    getExportSummaries(user.businessId),
    prisma.exportAuditLog.findMany({
      include: {
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      where: {
        businessId: user.businessId,
      },
    }),
  ]);
  const totalRows = summaries.reduce((total, summary) => total + summary.rows, 0);

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Export center
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Backup and Excel exports
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Download business data for audit, migration, reporting, or backup.
            Every export is scoped to the current business workspace.
          </p>
        </div>
        <Link
          className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
          href="/dashboard/exports/backup"
        >
          Download full backup
        </Link>
        <Link
          className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
          href="/dashboard/exports/workbook"
        >
          Download Excel workbook
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          helper="CSV and XLSX datasets available now."
          label="Export types"
          value={summaries.length}
        />
        <MetricCard
          helper="Rows across exportable datasets."
          label="Exportable rows"
          value={totalRows}
        />
        <MetricCard
          helper="Multi-sheet XLSX plus JSON backup."
          label="Workbook"
          value="Ready"
        />
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Dataset exports
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Operational datasets
              </h3>
            </div>
            <span className="text-sm text-muted-foreground">
              {summaries.length} files
            </span>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {summaries.map((summary) => (
              <article
                className="grid gap-4 rounded-[10px] border border-border bg-[#f8f9fa] p-3"
                key={summary.href}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-lg font-semibold">{summary.label}</h4>
                    <span className="rounded-[5px] bg-[#f8f9fa] px-2 py-0.5 text-[9.5px] font-medium text-muted-foreground">
                      {summary.rows} rows
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {summary.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex h-[34px] w-fit items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
                    href={summary.href}
                  >
                    CSV
                  </Link>
                  <Link
                    className="inline-flex h-10 w-fit items-center justify-center rounded-lg border border-accent bg-accent px-3 text-sm font-semibold text-white transition hover:bg-[#2d7bc9]"
                    href={`${summary.href}/xlsx`}
                  >
                    XLSX
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-6">
          <div className="rounded-[14px] border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Full business workbook
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Excel export</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Download one XLSX workbook with customers, products, invoices,
              line items, payments, refunds, refund items, expenses, inventory
              movements, templates, and import/OCR history.
            </p>
            <Link
              className="mt-5 inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
              href="/dashboard/exports/workbook"
            >
              Download workbook XLSX
            </Link>
            <Link
              className="mt-3 inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
              href="/dashboard/exports/backup"
            >
              Download backup JSON
            </Link>
          </div>

          <div className="rounded-[10px] border border-dashed border-border bg-[#f8f9fa] p-5">
            <p className="text-sm font-medium text-muted-foreground">
              Security note
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Password hashes and session tokens are intentionally excluded from
              backup files. Receipt files and uploaded images are referenced by
              path; the binary file archive can be added as a later export pass.
            </p>
          </div>

          {user.role === "owner" ? (
            <div className="rounded-[14px] border border-border bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Restore backup
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Merge JSON backup
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Upload a full backup JSON file to preview and merge records into
                this business. Current records are not deleted.
              </p>
              <div className="mt-5">
                <BackupRestoreForm />
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[14px] border border-border bg-white p-4">
            <div className="border-b border-border p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Audit history
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Recent report exports
              </h3>
            </div>
            {recentExportLogs.length === 0 ? (
              <div className="p-5 text-sm leading-6 text-muted-foreground">
                Report downloads will appear here after the first XLSX export.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentExportLogs.map((log) => (
                  <div className="grid gap-2 p-4 text-sm" key={log.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {reportLabel(log.reportName)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {filterSummary(log.filtersJson)}
                        </p>
                      </div>
                      <span className="rounded-[5px] bg-[#e6f1fb] px-2 py-0.5 text-[9.5px] font-medium uppercase text-[#185fa5]">
                        {log.format}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      {log.rowCount} rows / {log.createdBy?.name || log.createdBy?.email || "Unknown user"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dateTimeFormatter(log.createdAt)}
                    </p>
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
