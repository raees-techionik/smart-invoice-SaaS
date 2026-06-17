"use client";

import { useActionState } from "react";

import {
  sendBusinessEmailTest,
  type SettingsActionState,
} from "@/app/dashboard/settings/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";

type EmailTestFormProps = {
  canTest: boolean;
  defaultRecipientEmail: string;
};

const initialState: SettingsActionState = {};

function FormMessage({ state }: { state: SettingsActionState }) {
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

export function EmailTestForm({
  canTest,
  defaultRecipientEmail,
}: EmailTestFormProps) {
  const [state, action] = useActionState(sendBusinessEmailTest, initialState);

  return (
    <form action={action} className="grid gap-4 rounded-md border border-border bg-muted p-4">
      <div>
        <p className="text-sm font-semibold">Send test email</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Save SMTP settings first, then send a quick delivery test.
        </p>
      </div>
      <FormMessage state={state} />
      <label className="grid gap-2 text-sm font-medium">
        Test recipient
        <input
          className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
          defaultValue={defaultRecipientEmail}
          disabled={!canTest}
          name="recipientEmail"
          placeholder="you@example.com"
          required
          type="email"
        />
      </label>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          {canTest
            ? "Ready to send a test using the saved SMTP settings."
            : "Configure SMTP host, port, and sender email before testing."}
        </p>
        <SubmitButton disabled={!canTest} pendingLabel="Sending test...">
          Send test
        </SubmitButton>
      </div>
    </form>
  );
}
