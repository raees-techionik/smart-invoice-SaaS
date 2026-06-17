"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  finalizeDraftInvoiceWithInventory,
  type InvoiceActionState,
} from "@/app/dashboard/invoices/actions";

const initialState: InvoiceActionState = {};

function FinalizeButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9] disabled:cursor-not-allowed disabled:opacity-70"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Finalizing..." : "Finalize invoice"}
    </button>
  );
}

export function FinalizeInvoiceForm({
  invoiceId,
  stockWarnings = [],
}: {
  invoiceId: string;
  stockWarnings?: string[];
}) {
  const [state, action] = useActionState(
    finalizeDraftInvoiceWithInventory,
    initialState,
  );
  const hasStockWarnings = stockWarnings.length > 0;

  return (
    <form action={action} className="grid gap-2">
      <input name="invoiceId" type="hidden" value={invoiceId} />
      <FinalizeButton disabled={hasStockWarnings} />
      {hasStockWarnings ? (
        <div className="max-w-sm rounded-[7px] border border-[#ba7517]/30 bg-[#faeeda] px-3 py-2 text-[11.5px] font-medium text-[#854f0b]">
          <p>Resolve stock shortages before finalizing:</p>
          <ul className="mt-1 list-disc pl-4">
            {stockWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.error ? (
        <p className="max-w-xs rounded-[7px] border border-[#e24b4a]/30 bg-[#fcebeb] px-3 py-2 text-[11.5px] font-medium text-[#a32d2d]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
