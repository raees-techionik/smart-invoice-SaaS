import Link from "next/link";
import { notFound } from "next/navigation";

import {
  applyReviewedImportJob,
  skipImportJob,
  updateExtractedFields,
} from "@/app/dashboard/imports/actions";
import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { mappedFieldsByImportType, readableImportType } from "@/app/_backend/lib/imports";

type ImportDetailPageProps = {
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

function confidenceText(value: unknown) {
  return `${Math.round(Number(value) * 100)}%`;
}

type ReviewField = {
  confidence: unknown;
  correctedValue: string | null;
  extractedValue: string | null;
  fieldName: string;
  status: string;
};

function confidenceLevel(value: unknown) {
  const confidence = Number(value);

  if (confidence >= 0.75) {
    return "high";
  }

  if (confidence >= 0.5) {
    return "medium";
  }

  return "low";
}

function confidenceTone(value: unknown) {
  const level = confidenceLevel(value);

  if (level === "high") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (level === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function ConfidenceBadge({ value }: { value: unknown }) {
  const level = confidenceLevel(value);

  return (
    <span
      className={`inline-flex rounded-[5px] border px-2 py-0.5 text-[9.5px] font-medium capitalize ${confidenceTone(
        value,
      )}`}
    >
      {confidenceText(value)} {level}
    </span>
  );
}

function canonicalFieldName(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function mappedFieldDefault(
  sourceLabel: string,
  allowedMappedFields: string[],
  mappingBySource: Map<string, string>,
) {
  const savedMapping = mappingBySource.get(sourceLabel);

  if (savedMapping) {
    return savedMapping;
  }

  const canonicalSource = canonicalFieldName(sourceLabel);

  return (
    allowedMappedFields.find(
      (field) => canonicalFieldName(field) === canonicalSource,
    ) ?? ""
  );
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
        : status === "ignored" || status === "skipped"
          ? "border-border bg-muted text-muted-foreground"
          : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <span
      className={`inline-flex rounded-[5px] border px-2 py-0.5 text-[9.5px] font-medium capitalize ${tone}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function errorTypeLabel(value: string) {
  const labels: Record<string, string> = {
    customer_match_required: "Customer match required",
    duplicate_customer: "Duplicate customer",
    duplicate_expense: "Duplicate expense",
    duplicate_file: "Duplicate file",
    duplicate_invoice: "Duplicate invoice",
    duplicate_product: "Duplicate product",
    insufficient_stock: "Insufficient stock",
    inventory_product_required: "Inventory product required",
    payment_invoice_required: "Payment invoice required",
    not_reviewed: "Review required",
    possible_customer_match: "Possible customer match",
    possible_product_match: "Possible product match",
    product_match_required: "Product match required",
    total_mismatch: "Total mismatch",
    unsupported_import_type: "Unsupported import type",
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

function errorTone(value: string) {
  if (value.startsWith("possible_")) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (
    value === "duplicate_expense" ||
    value === "duplicate_invoice" ||
    value === "total_mismatch"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-border bg-muted text-muted-foreground";
}

function ErrorTypeBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-[5px] border px-2 py-0.5 text-[9.5px] font-medium capitalize ${errorTone(
        value,
      )}`}
    >
      {errorTypeLabel(value)}
    </span>
  );
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

function valueForField(fields: ReviewField[], fieldName: string) {
  const field = fields.find((currentField) => currentField.fieldName === fieldName);
  const value = field?.correctedValue ?? field?.extractedValue ?? "";

  return value.trim();
}

function numberValue(value: string) {
  const normalizedValue = value.replace(/[^\d.-]/g, "");
  const parsedValue = Number(normalizedValue);

  return normalizedValue && Number.isFinite(parsedValue) ? parsedValue : null;
}

function totalMismatchWarning(fields: ReviewField[]) {
  const subtotal = numberValue(valueForField(fields, "subtotal"));
  const discountTotal = numberValue(valueForField(fields, "discountTotal")) ?? 0;
  const taxTotal = numberValue(valueForField(fields, "taxTotal")) ?? 0;
  const grandTotal = numberValue(valueForField(fields, "grandTotal"));

  if (subtotal === null || grandTotal === null) {
    return null;
  }

  const expectedGrandTotal = subtotal - discountTotal + taxTotal;
  const difference = Math.abs(expectedGrandTotal - grandTotal);

  if (difference <= 0.01) {
    return null;
  }

  return `Total mismatch: subtotal - discount + tax = ${expectedGrandTotal.toFixed(
    2,
  )}, but extracted grand total is ${grandTotal.toFixed(2)}.`;
}

function reviewWarnings(fields: ReviewField[], importType: string) {
  const warnings: string[] = [];
  const lowConfidenceFields = fields
    .filter(
      (field) =>
        !field.fieldName.startsWith("source_") &&
        Number(field.confidence) < 0.5,
    )
    .map((field) => field.fieldName);
  const extractionWarning = valueForField(fields, "extraction_warning");

  if (extractionWarning) {
    warnings.push(extractionWarning);
  }

  if (lowConfidenceFields.length > 0) {
    warnings.push(
      `Low-confidence fields need review: ${lowConfidenceFields
        .slice(0, 6)
        .join(", ")}${lowConfidenceFields.length > 6 ? "..." : ""}.`,
    );
  }

  if (importType === "invoices") {
    const mismatchWarning = totalMismatchWarning(fields);

    if (mismatchWarning) {
      warnings.push(mismatchWarning);
    }
  }

  return warnings;
}

function sourcePreviewType(fileName: string, fileType: string) {
  const lowerName = fileName.toLowerCase();

  if (fileType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "document";
  }

  if (
    fileType.startsWith("image/") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp")
  ) {
    return "document";
  }

  return "text";
}

function SourceDocumentPreview({
  extractedText,
  fileHref,
  fileName,
  fileType,
}: {
  extractedText: string | null;
  fileHref: string;
  fileName: string;
  fileType: string;
}) {
  const previewType = sourcePreviewType(fileName, fileType);
  const textPreview = extractedText?.trim();

  return (
    <div className="grid gap-3 rounded-[10px] border border-border bg-[#f8f9fa] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            Source preview
          </p>
          <p className="mt-1 truncate text-[12px] font-semibold">{fileName}</p>
        </div>
        <Link
          className="inline-flex h-[30px] shrink-0 items-center justify-center rounded-lg border border-border bg-white px-2.5 text-[11px] font-medium transition hover:bg-[#e6f1fb]"
          href={fileHref}
          target="_blank"
        >
          Open
        </Link>
      </div>

      {previewType === "document" ? (
        <object
          className="h-[360px] w-full rounded-[8px] border border-border bg-white"
          data={fileHref}
          type={fileType || undefined}
        >
          <div className="grid h-[360px] place-items-center rounded-[8px] border border-border bg-white p-6 text-center text-sm leading-6 text-muted-foreground">
            File preview unavailable.
          </div>
        </object>
      ) : (
        <pre className="max-h-[360px] overflow-y-auto whitespace-pre-wrap break-words rounded-[8px] border border-border bg-white p-3 text-[11px] leading-5 text-slate-700">
          {textPreview || "No extracted text available."}
        </pre>
      )}
    </div>
  );
}

export default async function ImportDetailPage({
  params,
}: ImportDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  const importJob = await prisma.importJob.findFirst({
    include: {
      createdBy: {
        select: {
          email: true,
          name: true,
        },
      },
      documents: {
        include: {
          fields: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      errors: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    where: {
      businessId: user.businessId,
      id,
    },
  });

  if (!importJob) {
    notFound();
  }

  const allowedMappedFields =
    mappedFieldsByImportType[
      importJob.importType as keyof typeof mappedFieldsByImportType
    ] ?? [];
  const mappings = await prisma.documentFieldMapping.findMany({
    orderBy: {
      timesUsed: "desc",
    },
    where: {
      businessId: user.businessId,
    },
  });
  const mappingBySource = new Map(
    mappings.map((mapping) => [mapping.sourceLabel, mapping.mappedField]),
  );
  const canApplyReviewedJob =
    importJob.status === "reviewed" &&
    (importJob.importType === "customers" ||
      importJob.importType === "products" ||
      importJob.importType === "invoices" ||
      importJob.importType === "expenses" ||
      importJob.importType === "payments" ||
      importJob.importType === "inventory");
  const isAppliedJob =
    importJob.status === "imported" ||
    importJob.status === "imported_with_errors";
  const isRecordResultStatus = isAppliedJob || importJob.status === "failed";
  const isSkippable =
    !isAppliedJob &&
    importJob.status !== "skipped" &&
    importJob.status !== "ignored";
  const hasDuplicateErrors = importJob.errors.some((e) =>
    e.errorType.startsWith("duplicate_"),
  );
  const errorSummary = Array.from(
    importJob.errors
      .reduce((summary, error) => {
        summary.set(error.errorType, (summary.get(error.errorType) ?? 0) + 1);
        return summary;
      }, new Map<string, number>())
      .entries(),
  ).sort((left, right) => right[1] - left[1]);

  return (
    <div className="grid gap-3.5">
      <header className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#185fa5]">
            Import review
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            {importJob.fileName}
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Review extracted values, correct fields, and save mapping hints
            before this job is transformed into live{" "}
            {readableImportType(importJob.importType)} records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href="/dashboard/imports"
          >
            Back to imports
          </Link>
          <Link
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
            href={`/dashboard/imports/${importJob.id}/xlsx`}
          >
            Download Excel
          </Link>
          {isSkippable ? (
            <form action={skipImportJob}>
              <input name="importJobId" type="hidden" value={importJob.id} />
              <button
                className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium text-muted-foreground transition hover:bg-red-50 hover:text-red-700"
                type="submit"
              >
                Skip job
              </button>
            </form>
          ) : null}
          {hasDuplicateErrors && !isAppliedJob ? (
            <form action={applyReviewedImportJob}>
              <input name="importJobId" type="hidden" value={importJob.id} />
              <input name="forceImport" type="hidden" value="true" />
              <button
                className="inline-flex h-[34px] items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-[11.5px] font-medium text-amber-800 transition hover:bg-amber-100"
                type="submit"
              >
                Import as new
              </button>
            </form>
          ) : null}
          {canApplyReviewedJob ? (
            <form action={applyReviewedImportJob}>
              <input name="importJobId" type="hidden" value={importJob.id} />
              <button
                className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
                type="submit"
              >
                Apply to {readableImportType(importJob.importType)}
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[14px] border border-border bg-white p-[15px]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Status
          </p>
          <div className="mt-3">
            <StatusBadge status={importJob.status} />
          </div>
        </div>
        <div className="rounded-[14px] border border-border bg-white p-[15px]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Target
          </p>
          <p className="mt-3 text-2xl font-semibold capitalize">
            {readableImportType(importJob.importType)}
          </p>
        </div>
        <div className="rounded-[14px] border border-border bg-white p-[15px]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {isRecordResultStatus ? "Created records" : "Reviewed fields"}
          </p>
          <p className="mt-3 text-2xl font-semibold">
            {importJob.successfulRows} / {importJob.totalRows}
          </p>
        </div>
        <div className="rounded-[14px] border border-border bg-white p-[15px]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Created
          </p>
          <p className="mt-3 text-2xl font-semibold">
            {dateFormatter(importJob.createdAt)}
          </p>
        </div>
      </section>

      <section className="grid items-start gap-3.5 xl:grid-cols-[0.72fr_1.28fr]">
        <aside className="grid content-start gap-6">
          <div className="rounded-[14px] border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Job metadata
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <DetailRow label="File type" value={importJob.fileType} />
              <DetailRow
                label="Uploaded by"
                value={importJob.createdBy?.name ?? "System"}
              />
              <DetailRow
                label="Uploader email"
                value={importJob.createdBy?.email ?? "Not available"}
              />
              <DetailRow
                label={
                  isRecordResultStatus ? "Failed records" : "Needs review"
                }
                value={String(importJob.failedRows)}
              />
            </dl>
          </div>

          <div className="rounded-[10px] border border-dashed border-border bg-[#f8f9fa] p-5">
            <p className="text-sm font-medium text-muted-foreground">
              Apply note
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Save each document review first. Once the whole job is reviewed,
              customer, product, invoice, expense, payment, and inventory stock
              imports can be applied into live records. Invoice imports create
              draft invoices and flag unmatched customers or products for manual
              resolution.
            </p>
          </div>

          {importJob.errors.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-medium text-red-700">
                Apply error report
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {errorSummary.map(([errorType, count]) => (
                  <span
                    className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700"
                    key={errorType}
                  >
                    {errorTypeLabel(errorType)}: {count}
                  </span>
                ))}
              </div>
              <div className="mt-4 grid gap-3">
                {importJob.errors.map((error) => (
                  <div
                    className="rounded-lg border border-red-200 bg-white p-3 text-sm"
                    key={error.id}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ErrorTypeBadge value={error.errorType} />
                      <span className="text-xs font-semibold text-muted-foreground">
                        Row {error.rowNumber ?? "-"}
                      </span>
                    </div>
                    <p className="mt-2 font-medium text-red-700">
                      {error.message}
                    </p>
                    {error.fieldName || error.originalValue ? (
                      <p className="mt-1 text-muted-foreground">
                        {error.fieldName ?? "field"}:{" "}
                        {error.originalValue ?? "not available"}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="grid max-h-[1400px] gap-3.5 overflow-y-auto overflow-x-hidden pr-1">
          {importJob.documents.map((document) => {
            const fileHref = `/dashboard/imports/${importJob.id}/documents/${document.id}/file`;
            const warnings = reviewWarnings(document.fields, importJob.importType);

            return (
              <section
                className="overflow-hidden rounded-[14px] border border-border bg-white p-4"
                key={document.id}
              >
              <div className="flex flex-col gap-3 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Imported document
                  </p>
                  <h3 className="mt-1 text-[13px] font-medium">
                    {document.originalFileName}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {document.documentType.replaceAll("_", " ")}
                  </p>
                  <div className="mt-3">
                    <ConfidenceBadge value={document.confidenceScore} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={document.status} />
                </div>
              </div>

              <form action={updateExtractedFields} className="grid gap-4 p-5">
                <input name="importJobId" type="hidden" value={importJob.id} />
                <input name="documentId" type="hidden" value={document.id} />

                <div className="grid gap-4 2xl:grid-cols-[0.7fr_1.3fr]">
                  <SourceDocumentPreview
                    extractedText={document.extractedText}
                    fileHref={fileHref}
                    fileName={document.originalFileName}
                    fileType={importJob.fileType}
                  />

                  <div className="grid content-start gap-4">
                    {warnings.length > 0 ? (
                      <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-semibold">Review warnings</p>
                        {warnings.map((warning) => (
                          <p key={warning}>{warning}</p>
                        ))}
                      </div>
                    ) : null}

                    <div className="grid max-h-[640px] gap-3 overflow-y-auto overflow-x-hidden pr-1">
                      {document.fields.map((field) => {
                        const lowConfidence =
                          confidenceLevel(field.confidence) === "low";

                        return (
                          <article
                            className={`grid gap-3 rounded-[10px] border p-3 ${
                              lowConfidence
                                ? "border-red-200 bg-red-50/60"
                                : "border-border bg-[#f8f9fa]"
                            }`}
                            key={field.id}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <input
                                  name="fieldId"
                                  type="hidden"
                                  value={field.id}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="break-words text-sm font-semibold">
                                    {field.fieldName}
                                  </p>
                                  {mappingBySource.has(field.fieldName) ? (
                                    <span className="inline-flex rounded-[5px] border border-[#635bff]/25 bg-[#eef2ff] px-2 py-0.5 text-[9.5px] font-medium text-[#4f46e5]">
                                      Learned
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  Source field
                                </p>
                              </div>
                              <ConfidenceBadge value={field.confidence} />
                            </div>

                            <div className="rounded-[8px] border border-border bg-white/85 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                Extracted value
                              </p>
                              <p className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                                {field.extractedValue || "No extracted value"}
                              </p>
                            </div>

                            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_180px_150px]">
                              <label className="grid min-w-0 gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                                Corrected value
                                <textarea
                                  className="min-h-24 w-full min-w-0 rounded-[7px] border border-border bg-white px-2.5 py-2 text-[12px] text-foreground outline-none transition focus:border-accent"
                                  defaultValue={
                                    field.correctedValue ??
                                    field.extractedValue ??
                                    ""
                                  }
                                  name={`correctedValue:${field.id}`}
                                />
                              </label>

                              <label className="grid min-w-0 gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                                Map to
                                <select
                                  className="h-[34px] w-full min-w-0 rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
                                  defaultValue={mappedFieldDefault(
                                    field.fieldName,
                                    allowedMappedFields,
                                    mappingBySource,
                                  )}
                                  name={`mappedField:${field.id}`}
                                >
                                  <option value="">Do not map yet</option>
                                  {allowedMappedFields.map((mappedField) => (
                                    <option
                                      key={mappedField}
                                      value={mappedField}
                                    >
                                      {mappedField}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="grid min-w-0 gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                                Status
                                <select
                                  className="h-[34px] w-full min-w-0 rounded-[7px] border border-border bg-white px-2.5 text-[12px] capitalize text-foreground outline-none transition focus:border-accent"
                                  defaultValue={field.status}
                                  name={`status:${field.id}`}
                                >
                                  <option value="extracted">Extracted</option>
                                  <option value="needs_review">
                                    Needs review
                                  </option>
                                  <option value="reviewed">Reviewed</option>
                                  <option value="ignored">Ignored</option>
                                </select>
                              </label>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9]"
                    type="submit"
                  >
                    Save review
                  </button>
                </div>
              </form>
            </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
