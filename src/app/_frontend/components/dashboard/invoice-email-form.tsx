"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  prepareInvoiceEmail,
  type InvoiceEmailActionState,
} from "@/app/dashboard/invoices/actions";

type InvoiceEmailFormProps = {
  defaultBody: string;
  defaultCcEmail?: string;
  defaultRecipientEmail: string;
  defaultSubject: string;
  invoiceId: string;
};

const initialState: InvoiceEmailActionState = {};

function FormMessage({ state }: { state: InvoiceEmailActionState }) {
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

function PrepareEmailButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white transition hover:bg-[#2d7bc9] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Preparing..." : "Prepare email"}
    </button>
  );
}

export function InvoiceEmailForm({
  defaultBody,
  defaultCcEmail = "",
  defaultRecipientEmail,
  defaultSubject,
  invoiceId,
}: InvoiceEmailFormProps) {
  const [state, action] = useActionState(prepareInvoiceEmail, initialState);

  return (
    <form action={action} className="grid gap-4">
      <input name="invoiceId" type="hidden" value={invoiceId} />
      <FormMessage state={state} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Recipient email
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={defaultRecipientEmail}
            name="recipientEmail"
            placeholder="customer@example.com"
            required
            type="email"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          CC email
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
            defaultValue={defaultCcEmail}
            name="ccEmail"
            placeholder="accounts@example.com, owner@example.com"
            type="text"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        Subject
        <input
          className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition focus:border-accent"
          defaultValue={defaultSubject}
          name="subject"
          required
          type="text"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Email body
        <textarea
          className="min-h-80 rounded-md border border-border bg-white px-3 py-2 font-mono text-sm leading-6 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          defaultValue={defaultBody}
          name="body"
          required
        />
      </label>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>
          This saves the send-ready content now. Actual SMTP delivery will be
          connected after business email settings are added.
        </p>
        <PrepareEmailButton />
      </div>
    </form>
  );
}
