"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  recordPayment,
  type PaymentActionState,
} from "@/app/dashboard/payments/actions";

type InvoiceOption = {
  balanceAmount: string;
  customerName: string;
  id: string;
  invoiceNumber: string;
};

type PaymentFormProps = {
  invoiceId?: string;
  invoiceOptions?: InvoiceOption[];
  maxAmount?: string;
};

const initialState: PaymentActionState = {};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function FormMessage({ state }: { state: PaymentActionState }) {
  if (state.error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
        {state.success}
      </p>
    );
  }

  return null;
}

function SubmitPaymentButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Recording..." : "Record payment"}
    </button>
  );
}

export function PaymentForm({
  invoiceId,
  invoiceOptions = [],
  maxAmount,
}: PaymentFormProps) {
  const [state, action] = useActionState(recordPayment, initialState);
  const hasInvoiceTarget = Boolean(invoiceId) || invoiceOptions.length > 0;

  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      {!hasInvoiceTarget ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          There are no finalized invoices with an open balance.
        </p>
      ) : null}

      {invoiceId ? (
        <input name="invoiceId" type="hidden" value={invoiceId} />
      ) : (
        <label className="grid gap-2 text-sm font-medium">
          Invoice
          <select
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            disabled={!hasInvoiceTarget}
            name="invoiceId"
            required
          >
            <option value="">Select invoice</option>
            {invoiceOptions.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber} - {invoice.customerName} - balance{" "}
                {invoice.balanceAmount}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Amount
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            max={maxAmount}
            min="0.01"
            name="amount"
            placeholder="0.00"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Payment date
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={todayDate()}
            name="paymentDate"
            type="date"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Method
          <select
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue="cash"
            name="paymentMethod"
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium md:col-span-2">
          Notes
          <textarea
            className="min-h-24 rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            name="notes"
            placeholder="Receipt reference, transfer id, or internal notes."
          />
        </label>
      </div>

      <div className="flex justify-end">
        <SubmitPaymentButton disabled={!hasInvoiceTarget} />
      </div>
    </form>
  );
}
