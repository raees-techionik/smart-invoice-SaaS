"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createRefund,
  type RefundActionState,
} from "@/app/dashboard/refunds/actions";

type RefundLine = {
  id: string;
  itemName: string;
  lineTotal: string;
  quantity: string;
  refundedQuantity: string;
  remainingQuantity: string;
  unit: string | null;
  unitPrice: string;
};

type RefundFormProps = {
  currency: string;
  invoiceId: string;
  lines: RefundLine[];
  refundablePaidAmount: string;
};

const initialState: RefundActionState = {};

function numericValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decimalText(value: number | string) {
  const parsed = typeof value === "string" ? Number(value) : value;

  if (!Number.isFinite(parsed)) {
    return "0";
  }

  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}

function currencyFormatter(currency: string) {
  return new Intl.NumberFormat("en-PK", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  });
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-[34px] w-full items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Recording refund..." : "Record refund"}
    </button>
  );
}

export function RefundForm({
  currency,
  invoiceId,
  lines,
  refundablePaidAmount,
}: RefundFormProps) {
  const [state, action] = useActionState(createRefund, initialState);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const money = useMemo(() => currencyFormatter(currency), [currency]);
  const selectedRefundTotal = lines.reduce((total, line) => {
    const selectedQuantity = numericValue(quantities[line.id] ?? "0");
    const originalQuantity = numericValue(line.quantity);
    const lineTotal = numericValue(line.lineTotal);
    const perUnitRefund = originalQuantity > 0 ? lineTotal / originalQuantity : 0;

    return total + selectedQuantity * perUnitRefund;
  }, 0);
  const overRemainingQuantity = lines.some(
    (line) =>
      numericValue(quantities[line.id] ?? "0") >
      numericValue(line.remainingQuantity),
  );
  const overPaidAmount =
    selectedRefundTotal > numericValue(refundablePaidAmount);
  const hasSelectedQuantity = lines.some(
    (line) => numericValue(quantities[line.id] ?? "0") > 0,
  );
  const refundableLines = lines.filter(
    (line) => numericValue(line.remainingQuantity) > 0,
  );
  const disabled =
    refundableLines.length === 0 ||
    !hasSelectedQuantity ||
    overRemainingQuantity ||
    overPaidAmount;

  function updateQuantity(lineId: string, quantity: string) {
    setQuantities((currentQuantities) => ({
      ...currentQuantities,
      [lineId]: quantity,
    }));
  }

  return (
    <form action={action} className="grid gap-4">
      <input name="invoiceId" type="hidden" value={invoiceId} />

      {refundableLines.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          This invoice has no remaining refundable line quantities.
        </p>
      ) : (
        <div className="grid gap-3">
          {lines.map((line) => {
            const remainingQuantity = numericValue(line.remainingQuantity);
            const selectedQuantity = quantities[line.id] ?? "";

            return (
              <div
                className="rounded-[10px] border border-border bg-[#f8f9fa] p-3"
                key={line.id}
              >
                <input name="invoiceItemId" type="hidden" value={line.id} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{line.itemName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sold {decimalText(line.quantity)} {line.unit || "units"} -
                      refundable {decimalText(line.remainingQuantity)}
                    </p>
                  </div>
                  <p className="text-right text-sm font-semibold">
                    {money.format(numericValue(line.lineTotal))}
                  </p>
                </div>
                <label className="mt-3 grid gap-1 text-xs font-semibold text-muted-foreground">
                  Return quantity
                  <input
                    className="h-10 rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-disabled={remainingQuantity <= 0}
                    max={line.remainingQuantity}
                    min="0"
                    name="returnQuantity"
                    onChange={(event) =>
                      updateQuantity(line.id, event.target.value)
                    }
                    placeholder="0"
                    readOnly={remainingQuantity <= 0}
                    step="1"
                    type="number"
                    value={remainingQuantity <= 0 ? "0" : selectedQuantity}
                  />
                </label>
                {numericValue(line.refundedQuantity) > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Already refunded {decimalText(line.refundedQuantity)}{" "}
                    {line.unit || "units"}.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <label className="grid gap-1 text-sm font-semibold">
        Refund method
        <select
          className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
          name="refundMethod"
          defaultValue="cash"
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="card">Card</option>
          <option value="store_credit">Store credit</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label className="grid gap-1 text-sm font-semibold">
        Reason
        <input
          className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
          name="reason"
          placeholder="Damaged, wrong size, customer return..."
        />
      </label>

      <label className="grid gap-1 text-sm font-semibold">
        Notes
        <textarea
          className="min-h-20 rounded-lg border border-border bg-white px-3 py-2 text-sm font-normal outline-none transition placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/15"
          name="notes"
          placeholder="Optional refund note"
        />
      </label>

      <div className="rounded-lg bg-muted p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Estimated refund</span>
          <span className="font-semibold">
            {money.format(selectedRefundTotal)}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span className="text-muted-foreground">Remaining paid amount</span>
          <span className="font-semibold">
            {money.format(numericValue(refundablePaidAmount))}
          </span>
        </div>
        {overRemainingQuantity ? (
          <p className="mt-2 font-medium text-danger">
            One or more return quantities exceed the remaining refundable
            quantity.
          </p>
        ) : null}
        {overPaidAmount ? (
          <p className="mt-2 font-medium text-danger">
            Refund exceeds the remaining paid amount on this invoice.
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          {state.success}
        </p>
      ) : null}

      <SubmitButton disabled={disabled} />
    </form>
  );
}
