"use client";

import { useActionState } from "react";

import {
  updateBusinessSettings,
  type SettingsActionState,
} from "@/app/dashboard/settings/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";

type BusinessSettingsFormProps = {
  defaults: {
    address: string;
    category: string;
    currency: string;
    defaultNotes: string;
    defaultTerms: string;
    email: string;
    invoicePrefix: string;
    name: string;
    ownerName: string;
    phone: string;
    taxNumber: string;
  };
};

const initialState: SettingsActionState = {};

function Field({
  label,
  name,
  defaultValue,
  required = false,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
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

function TextArea({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <textarea
        className="min-h-24 rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

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

export function BusinessSettingsForm({ defaults }: BusinessSettingsFormProps) {
  const [state, action] = useActionState(updateBusinessSettings, initialState);

  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          defaultValue={defaults.name}
          label="Business name"
          name="name"
          placeholder="Ahmed Traders"
          required
        />
        <Field
          defaultValue={defaults.ownerName}
          label="Owner name"
          name="ownerName"
          placeholder="Raees Ahmed"
          required
        />
        <Field
          defaultValue={defaults.phone}
          label="Phone"
          name="phone"
          placeholder="+92..."
        />
        <Field
          defaultValue={defaults.email}
          label="Email"
          name="email"
          placeholder="business@example.com"
          type="email"
        />
        <Field
          defaultValue={defaults.currency}
          label="Currency"
          name="currency"
          placeholder="PKR"
          required
        />
        <Field
          defaultValue={defaults.category}
          label="Business category"
          name="category"
          placeholder="Retail shop, clinic, freelancer..."
          required
        />
        <Field
          defaultValue={defaults.invoicePrefix}
          label="Invoice prefix"
          name="invoicePrefix"
          placeholder="INV"
          required
        />
        <Field
          defaultValue={defaults.taxNumber}
          label="Tax number"
          name="taxNumber"
          placeholder="Optional"
        />
      </div>
      <Field
        defaultValue={defaults.address}
        label="Address"
        name="address"
        placeholder="Shop, street, city"
      />
      <TextArea
        defaultValue={defaults.defaultTerms}
        label="Default invoice terms"
        name="defaultTerms"
        placeholder="Payment due within 7 days."
      />
      <TextArea
        defaultValue={defaults.defaultNotes}
        label="Default invoice notes"
        name="defaultNotes"
        placeholder="Thank you for your business."
      />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving settings...">
          Save settings
        </SubmitButton>
      </div>
    </form>
  );
}
