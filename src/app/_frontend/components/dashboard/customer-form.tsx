"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createCustomer,
  type CustomerActionState,
  updateCustomer,
} from "@/app/dashboard/customers/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";

const initialState: CustomerActionState = {};

type CustomerFormDefaults = {
  address: string;
  businessName: string;
  email: string;
  name: string;
  notes: string;
  openingBalance: string;
  phone: string;
  status: string;
  taxNumber: string;
};

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
      {label}
      <input
        className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
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
    <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
      {label}
      <textarea
        className="min-h-20 rounded-[7px] border border-border bg-white px-2.5 py-2 text-[12px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function FormMessage({ state }: { state: CustomerActionState }) {
  if (state.error) {
    return (
      <p className="rounded-[7px] border border-[#e24b4a]/30 bg-[#fcebeb] px-3 py-2 text-[11.5px] font-medium text-[#a32d2d]">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <div className="grid gap-2">
        <p className="rounded-[7px] border border-[#639922]/30 bg-[#eaf3de] px-3 py-2 text-[11.5px] font-medium text-[#3b6d11]">
          {state.success}
        </p>
        {state.warning ? (
          <p className="rounded-[7px] border border-[#ba7517]/30 bg-[#faeeda] px-3 py-2 text-[11.5px] font-medium text-[#854f0b]">
            {state.warning}
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}

export function CustomerForm({
  customerId,
  defaults,
  submitLabel = "Save customer",
}: {
  customerId?: string;
  defaults?: CustomerFormDefaults;
  submitLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const actionHandler = customerId ? updateCustomer : createCustomer;
  const [state, action] = useActionState(actionHandler, initialState);

  useEffect(() => {
    if (state.success && !customerId) {
      formRef.current?.reset();
    }
  }, [customerId, state.success]);

  return (
    <form action={action} className="grid gap-3.5" ref={formRef}>
      {customerId ? (
        <input name="customerId" type="hidden" value={customerId} />
      ) : null}
      <FormMessage state={state} />
      <div className="grid gap-2.5 md:grid-cols-2">
        <Field
          defaultValue={defaults?.name}
          label="Customer name"
          name="name"
          placeholder="Ali Khan"
          required
        />
        <Field
          defaultValue={defaults?.businessName}
          label="Business name"
          name="businessName"
          placeholder="Ali Traders"
        />
        <Field
          defaultValue={defaults?.phone}
          label="Phone"
          name="phone"
          placeholder="+92..."
        />
        <Field
          defaultValue={defaults?.email}
          label="Email"
          name="email"
          placeholder="customer@example.com"
          type="email"
        />
        <Field
          defaultValue={defaults?.openingBalance}
          label="Opening balance"
          name="openingBalance"
          placeholder="0.00"
          type="number"
        />
        <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          Status
          <select
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
            defaultValue={defaults?.status ?? "active"}
            name="status"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <Field
          defaultValue={defaults?.taxNumber}
          label="Tax number"
          name="taxNumber"
          placeholder="Optional"
        />
        <Field
          defaultValue={defaults?.address}
          label="Address"
          name="address"
          placeholder="Shop, street, city"
        />
      </div>
      <TextArea
        defaultValue={defaults?.notes}
        label="Notes"
        name="notes"
        placeholder="Preferred delivery windows, payment habits, or reminders."
      />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving customer...">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
