"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  sendPreparedInvoiceEmail,
  type SendInvoiceEmailActionState,
} from "@/app/dashboard/invoices/actions";

type SendInvoiceEmailFormProps = {
  canSend: boolean;
  emailSendId: string;
  status: string;
};

const initialState: SendInvoiceEmailActionState = {};

function SendButton({
  canSend,
  status,
}: {
  canSend: boolean;
  status: string;
}) {
  const { pending } = useFormStatus();
  const isSent = status === "sent";
  const disabled = pending || !canSend || isSent || status === "sending";

  return (
    <button
      className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-3 text-xs font-semibold text-white transition hover:bg-[#2d7bc9] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      type="submit"
    >
      {pending || status === "sending"
        ? "Sending..."
        : isSent
          ? "Sent"
          : "Send now"}
    </button>
  );
}

export function SendInvoiceEmailForm({
  canSend,
  emailSendId,
  status,
}: SendInvoiceEmailFormProps) {
  const [state, action] = useActionState(
    sendPreparedInvoiceEmail,
    initialState,
  );

  return (
    <form action={action} className="grid gap-2 justify-items-end">
      <input name="emailSendId" type="hidden" value={emailSendId} />
      <SendButton canSend={canSend} status={status} />
      {state.error ? (
        <p className="max-w-xs text-right text-xs leading-5 text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="max-w-xs text-right text-xs leading-5 text-green-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
