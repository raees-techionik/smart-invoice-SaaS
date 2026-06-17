"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";

import {
  createExpense,
  type ExpenseActionState,
  updateExpense,
} from "@/app/dashboard/expenses/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";

const initialState: ExpenseActionState = {};

type ExpenseFormDefaults = {
  amount: string;
  attachmentPath?: string | null;
  category: string;
  date: string;
  notes: string;
  paymentMethod: string;
  vendor: string;
};

const categoryOptions = [
  "Rent",
  "Utilities",
  "Salaries",
  "Marketing",
  "Supplies",
  "Transport",
  "Software",
  "Tax",
  "Other",
];

const paymentMethods = [
  { label: "Cash", value: "cash" },
  { label: "Bank transfer", value: "bank_transfer" },
  { label: "Card", value: "card" },
  { label: "Cheque", value: "cheque" },
  { label: "Other", value: "other" },
];

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}
      <input
        className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
        defaultValue={defaultValue}
        min={type === "number" ? "0" : undefined}
        name={name}
        placeholder={placeholder}
        required={required}
        step={type === "number" ? "0.01" : undefined}
        type={type}
      />
    </label>
  );
}

function FormMessage({ state }: { state: ExpenseActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
        {state.success}
      </p>
    );
  }

  return null;
}

export function ExpenseForm({
  defaults,
  expenseId,
  submitLabel = "Save expense",
}: {
  defaults?: ExpenseFormDefaults;
  expenseId?: string;
  submitLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const actionHandler = expenseId ? updateExpense : createExpense;
  const [state, action] = useActionState(actionHandler, initialState);

  useEffect(() => {
    if (state.success && !expenseId) {
      formRef.current?.reset();
    }
  }, [expenseId, state.success]);

  return (
    <form action={action} className="grid gap-5" ref={formRef}>
      {expenseId ? (
        <input name="expenseId" type="hidden" value={expenseId} />
      ) : null}
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Category
          <select
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={defaults?.category ?? "Other"}
            name="category"
            required
          >
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <Field
          defaultValue={defaults?.amount}
          label="Amount"
          name="amount"
          placeholder="0.00"
          required
          type="number"
        />
        <Field
          defaultValue={defaults?.date}
          label="Expense date"
          name="date"
          required
          type="date"
        />
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Payment method
          <select
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={defaults?.paymentMethod ?? "cash"}
            name="paymentMethod"
          >
            {paymentMethods.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </label>
        <Field
          defaultValue={defaults?.vendor}
          label="Vendor"
          name="vendor"
          placeholder="Supplier, landlord, service provider"
        />
      </div>
      <label className="grid gap-2 text-sm font-medium text-foreground">
        Notes
        <textarea
          className="min-h-20 rounded-[7px] border border-border bg-white px-2.5 py-2 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
          defaultValue={defaults?.notes}
          name="notes"
          placeholder="Optional context for reports or reconciliation."
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-foreground">
        Receipt attachment
        <input
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="rounded-[10px] border border-dashed border-border bg-[#f8f9fa] px-3 py-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-accent/60"
          name="receipt"
          type="file"
        />
        <span className="text-xs font-normal leading-5 text-muted-foreground">
          Optional PDF, JPG, PNG, or WebP receipt up to 5 MB.
          {expenseId && defaults?.attachmentPath ? (
            <>
              {" "}
              Current receipt is attached.{" "}
              <Link
                className="font-semibold text-accent hover:underline"
                href={`/dashboard/expenses/${expenseId}/receipt`}
                target="_blank"
              >
                View receipt
              </Link>
            </>
          ) : null}
        </span>
      </label>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving expense...">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
