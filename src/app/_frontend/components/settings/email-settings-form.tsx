"use client";

import { useActionState } from "react";

import {
  updateBusinessEmailSettings,
  type SettingsActionState,
} from "@/app/dashboard/settings/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";

type EmailSettingsFormProps = {
  defaults: {
    fromEmail: string;
    fromName: string;
    hasPassword: boolean;
    replyToEmail: string;
    smtpHost: string;
    smtpPort: string;
    smtpSecure: boolean;
    smtpUsername: string;
  };
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

function Field({
  defaultValue,
  label,
  name,
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
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

export function EmailSettingsForm({ defaults }: EmailSettingsFormProps) {
  const [state, action] = useActionState(
    updateBusinessEmailSettings,
    initialState,
  );

  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          defaultValue={defaults.fromName}
          label="From name"
          name="fromName"
          placeholder="Ahmed Traders"
          required
        />
        <Field
          defaultValue={defaults.fromEmail}
          label="From email"
          name="fromEmail"
          placeholder="billing@example.com"
          required
          type="email"
        />
        <Field
          defaultValue={defaults.replyToEmail}
          label="Reply-to email"
          name="replyToEmail"
          placeholder="accounts@example.com"
          type="email"
        />
        <Field
          defaultValue={defaults.smtpHost}
          label="SMTP host"
          name="smtpHost"
          placeholder="smtp.gmail.com"
          required
        />
        <Field
          defaultValue={defaults.smtpPort}
          label="SMTP port"
          name="smtpPort"
          placeholder="587"
          required
          type="number"
        />
        <Field
          defaultValue={defaults.smtpUsername}
          label="SMTP username"
          name="smtpUsername"
          placeholder="billing@example.com"
        />
        <label className="grid gap-2 text-sm font-medium md:col-span-2">
          SMTP password
          <input
            className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            name="smtpPassword"
            placeholder={
              defaults.hasPassword
                ? "Password saved. Leave blank to keep it."
                : "App password or SMTP password"
            }
            type="password"
          />
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-md border border-border bg-muted px-3 py-3 text-sm">
        <input
          className="mt-1 h-4 w-4 rounded border-border"
          defaultChecked={defaults.smtpSecure}
          name="smtpSecure"
          type="checkbox"
        />
        <span>
          <span className="font-semibold">Use SSL/TLS connection</span>
          <span className="block text-muted-foreground">
            Enable this for port 465. For port 587, the app will use STARTTLS
            when the SMTP server advertises it.
          </span>
        </span>
      </label>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          Password status: {defaults.hasPassword ? "saved" : "not saved"}
        </p>
        <SubmitButton pendingLabel="Saving email settings...">
          Save email settings
        </SubmitButton>
      </div>
    </form>
  );
}
