import type { ReactNode } from "react";
import Link from "next/link";

import { BackupRestoreForm } from "@/app/_frontend/components/dashboard/backup-restore-form";
import { requireDataExporter } from "@/app/_backend/lib/auth/roles";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { getExportSummaries } from "@/app/_backend/lib/exports";
import { AppIcon, metricIconForLabel } from "@/app/_frontend/components/dashboard/app-icons";


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

function PremiumVisual() {
  return (
    <div className="premium-visual hidden xl:block" aria-hidden="true">
      <div className="premium-visual-rig">
        <div className="premium-visual-floor" />
        <div className="premium-visual-sheet" />
        <div className="premium-visual-cube" />
        <div className="premium-visual-coin"><AppIcon className="size-5" name="download" /></div>
      </div>
    </div>
  );
}

function ExportLink({
  children,
  href,
  primary = false,
  tall = false,
}: {
  children: ReactNode;
  href: string;
  primary?: boolean;
  tall?: boolean;
}) {
  return (
    <Link
      className={`inline-flex w-fit items-center justify-center rounded-lg border px-3 font-medium transition ${
        tall ? "h-10 text-sm font-semibold" : "h-[34px] text-[11.5px]"
      } ${
        primary
          ? "premium-button border-transparent text-white hover:brightness-105"
          : "premium-soft-button hover:border-[#635bff]/30 hover:bg-white"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
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
    <div className="relative grid min-w-0 gap-3.5">
      <PremiumVisual />
      <header className="premium-card relative z-[1] flex min-w-0 flex-col gap-4 overflow-hidden rounded-[16px] border p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#635bff]">
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
        <div className="flex min-w-0 flex-wrap gap-2">
          <ExportLink href="/dashboard/exports/backup" primary>
            Download full backup
          </ExportLink>
          <ExportLink href="/dashboard/exports/workbook">
            Download Excel workbook
          </ExportLink>
        </div>
      </header>

      <section className="relative z-[1] grid gap-4 md:grid-cols-3">
        <MetricCard
          helper="CSV and XLSX datasets available now."
          label="Export types"
          tone="neutral"
          value={summaries.length}
        />
        <MetricCard
          helper="Rows across exportable datasets."
          label="Exportable rows"
          tone="good"
          value={totalRows}
        />
        <MetricCard
          helper="Multi-sheet XLSX plus JSON backup."
          label="Workbook"
          tone="warn"
          value="Ready"
        />
      </section>

      <section className="relative z-[1] grid items-start gap-3.5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="premium-card flex max-h-[660px] flex-col overflow-hidden rounded-[16px] border p-4 md:max-h-[780px]">
          <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635bff]">
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
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overflow-x-hidden p-5 pr-4 md:grid-cols-2">
            {summaries.map((summary) => (
              <article
                className="grid gap-4 rounded-[12px] border border-white/70 bg-white/55 p-3 shadow-[0_12px_26px_rgba(36,42,94,0.06)] transition hover:border-[#635bff]/25 hover:bg-white/70"
                key={summary.href}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-lg font-semibold">{summary.label}</h4>
                    <span className="rounded-[5px] border border-white/70 bg-white/65 px-2 py-0.5 text-[9.5px] font-medium text-muted-foreground">
                      {summary.rows} rows
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {summary.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ExportLink href={summary.href}>CSV</ExportLink>
                  <ExportLink href={`${summary.href}/xlsx`} primary tall>
                    XLSX
                  </ExportLink>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-6">
          <div className="premium-card rounded-[16px] border p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00a884]">
              Full business workbook
            </p>
            <h3 className="mt-1 text-[13px] font-medium">Excel export</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Download one XLSX workbook with customers, products, invoices,
              line items, payments, refunds, refund items, expenses, inventory
              movements, templates, and import/OCR history.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ExportLink href="/dashboard/exports/workbook" primary>
                Download workbook XLSX
              </ExportLink>
              <ExportLink href="/dashboard/exports/backup">
                Download backup JSON
              </ExportLink>
            </div>
          </div>

          <div className="rounded-[12px] border border-dashed border-white/80 bg-white/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f59e0b]">
              Security note
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Password hashes and session tokens are intentionally excluded from
              backup files. Receipt files and uploaded images are referenced by
              path; the binary file archive can be added as a later export pass.
            </p>
          </div>

          {user.role === "owner" ? (
            <div className="premium-card rounded-[16px] border p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f59e0b]">
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

          <div className="premium-card flex max-h-[620px] flex-col overflow-hidden rounded-[16px] border p-4">
            <div className="border-b border-border p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635bff]">
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
              <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overflow-x-hidden pr-1">
                {recentExportLogs.map((log) => (
                  <div
                    className="grid gap-2 p-4 text-sm transition hover:bg-white/45"
                    key={log.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {reportLabel(log.reportName)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {filterSummary(log.filtersJson)}
                        </p>
                      </div>
                      <span className="rounded-[5px] border border-[#185fa5]/20 bg-[#e6f1fb] px-2 py-0.5 text-[9.5px] font-medium uppercase text-[#185fa5]">
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
