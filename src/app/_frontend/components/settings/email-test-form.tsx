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
    <form action={action} className="grid gap-4 rounded-xl border border-white/75 bg-white/55 p-4 shadow-[0_12px_28px_rgba(36,42,94,0.06)]">
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
          className="h-11 rounded-lg border border-white/80 bg-white/70 px-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition placeholder:text-[#a4acc0] focus:border-[#635bff]/40 focus:bg-white focus:ring-2 focus:ring-[#635bff]/10 disabled:cursor-not-allowed disabled:opacity-60"
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
