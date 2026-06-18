"use client";

import { useActionState } from "react";

import {
  createImportJob,
  type ImportActionState,
} from "@/app/dashboard/imports/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";

const initialState: ImportActionState = {};

const importTypeOptions = [
  { label: "Customers", value: "customers" },
  { label: "Products", value: "products" },
  { label: "Invoices", value: "invoices" },
  { label: "Expenses / receipts", value: "expenses" },
  { label: "Payments", value: "payments" },
  { label: "Inventory stock", value: "inventory" },
];

const documentTypeOptions = [
  { label: "CSV", value: "csv" },
  { label: "Spreadsheet", value: "spreadsheet" },
  { label: "Invoice", value: "invoice" },
  { label: "Receipt", value: "receipt" },
  { label: "Business card", value: "business_card" },
  { label: "Other", value: "other" },
];

function FormMessage({ state }: { state: ImportActionState }) {
  if (!state.error) {
    return null;
  }

  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {state.error}
    </p>
  );
}

export function ImportUploadForm() {
  const [state, action] = useActionState(createImportJob, initialState);

  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Import target
          <select
            className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue="customers"
            name="importType"
            required
          >
            {importTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Document type
          <select
            className="h-[34px] rounded-[8px] border border-white/70 bg-white/85 px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue="csv"
            name="documentType"
            required
          >
            {documentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-foreground">
        Source file
        <input
          accept=".csv,.txt,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,application/pdf,image/jpeg,image/png,image/webp,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="rounded-[10px] border border-dashed border-white/70 bg-white/65 px-3 py-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[#635bff] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-[#635bff]/60"
          name="importFile"
          required
          type="file"
        />
        <span className="text-xs font-normal leading-5 text-muted-foreground">
          Upload PDF, image, CSV, TXT, or XLSX files up to 10 MB. CSV/XLSX files
          are parsed into review rows; PDF text and image OCR are extracted into
          editable fields before saving.
        </span>
      </label>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Creating import job...">
          Upload and review
        </SubmitButton>
      </div>
    </form>
  );
}
