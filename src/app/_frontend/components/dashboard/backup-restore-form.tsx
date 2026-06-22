"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";
import {
  previewBackupRestore,
  restoreBackupMerge,
  type BackupRestoreActionState,
} from "@/app/dashboard/exports/actions";

const initialState: BackupRestoreActionState = {};

const sectionLabels: Record<string, string> = {
  communicationNotes: "Communication notes",
  customers: "Customers",
  documentFieldMappings: "Field mappings",
  expenses: "Expenses",
  importedDocuments: "Imported documents",
  importJobs: "Import jobs",
  inventoryMovements: "Inventory movements",
  invoiceEmails: "Invoice emails",
  invoiceTemplates: "Invoice templates",
  invoices: "Invoices",
  payments: "Payments",
  products: "Products",
  refunds: "Refunds",
};

function Message({ state }: { state: BackupRestoreActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm font-medium text-red-700 shadow-[0_8px_18px_rgba(127,29,29,0.06)]">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-lg border border-[#cfe4b8] bg-[#f2f8ea]/90 px-3 py-2 text-sm font-medium text-[#3b6d11] shadow-[0_8px_18px_rgba(63,98,18,0.06)]">
        {state.success}
      </p>
    );
  }

  return null;
}

function BackupSummary({ state }: { state: BackupRestoreActionState }) {
  const summary = state.result ?? state.preview;
  const restoreResult = state.result;

  if (!summary) {
    return null;
  }

  return (
    <div className="grid gap-3 rounded-[12px] border border-white/70 bg-white/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#635bff]">
          Backup preview
        </p>
        <p className="mt-1 text-sm font-semibold">
          {summary.sourceBusinessName ?? "Unknown business"} / v
          {summary.backupVersion}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Exported {summary.exportedAt ?? "date unavailable"}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(summary.counts).map(([section, count]) => (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-white/80 bg-white/70 px-3 py-2 text-sm shadow-[0_8px_18px_rgba(36,42,94,0.05)]"
            key={section}
          >
            <span>{sectionLabels[section] ?? section}</span>
            <span className="font-mono font-semibold">{count}</span>
          </div>
        ))}
      </div>

      {restoreResult ? (
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Restore result
          </p>
          {Object.entries(restoreResult.restored).map(([section, result]) => (
            <div
              className="grid gap-2 rounded-lg border border-white/80 bg-white/70 px-3 py-2 text-xs shadow-[0_8px_18px_rgba(36,42,94,0.05)] sm:grid-cols-4"
              key={section}
            >
              <span className="font-semibold">
                {sectionLabels[section] ?? section}
              </span>
              <span>Created {result.created}</span>
              <span>Updated {result.updated}</span>
              <span>Skipped {result.skipped}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-1 text-xs leading-5 text-muted-foreground">
        {summary.warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
      </div>
    </div>
  );
}

export function BackupRestoreForm() {
  const [previewState, previewAction] = useActionState(
    previewBackupRestore,
    initialState,
  );
  const [restoreState, restoreAction] = useActionState(
    restoreBackupMerge,
    initialState,
  );
  const activeState = restoreState.result || restoreState.error || restoreState.success
    ? restoreState
    : previewState;

  return (
    <div className="grid gap-5">
      <form action={previewAction} className="grid gap-4">
        <Message state={previewState} />
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Backup JSON file
          <input
            accept=".json,application/json,text/plain"
            className="rounded-[12px] border border-dashed border-white/80 bg-white/55 px-3 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] file:mr-4 file:rounded-md file:border-0 file:bg-[#635bff] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-[#635bff]/40"
            name="backupFile"
            required
            type="file"
          />
          <span className="text-xs font-normal leading-5 text-muted-foreground">
            Use the JSON file from Download full backup. Preview does not change
            data.
          </span>
        </label>
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Checking backup...">
            Preview backup
          </SubmitButton>
        </div>
      </form>

      <BackupSummary state={activeState} />

      <form action={restoreAction} className="grid gap-4">
        <Message state={restoreState} />
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Backup JSON file
          <input
            accept=".json,application/json,text/plain"
            className="rounded-[12px] border border-dashed border-white/80 bg-white/55 px-3 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] file:mr-4 file:rounded-md file:border-0 file:bg-[#635bff] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-[#635bff]/40"
            name="backupFile"
            required
            type="file"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Confirmation
          <input
            className="h-[34px] rounded-lg border border-white/80 bg-white/70 px-3 text-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-[#635bff]/40 focus:ring-2 focus:ring-[#635bff]/10"
            name="confirmation"
            placeholder="MERGE RESTORE"
            required
            type="text"
          />
          <span className="text-xs font-normal leading-5 text-muted-foreground">
            Type MERGE RESTORE. Existing records are kept; matching records are
            updated.
          </span>
        </label>
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Restoring backup...">
            Restore backup
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
