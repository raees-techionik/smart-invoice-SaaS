"use client";

import { useActionState } from "react";

import { loginOwner, registerOwner } from "@/app/login/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";
import type { ActionState } from "@/app/_backend/lib/auth/forms";
import { initialActionState } from "@/app/_backend/lib/auth/forms";

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-800">
      <span>{label}</span>
      <input
        autoComplete={autoComplete}
        className="h-[38px] rounded-[8px] border border-border bg-white px-3 text-[12px] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#378add]"
        minLength={minLength}
        name={name}
        placeholder={placeholder}
        required
        type={type}
      />
    </label>
  );
}

function FormError({ state }: { state: ActionState }) {
  if (!state.error) {
    return null;
  }

  return (
    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {state.error}
    </p>
  );
}

export function RegisterOwnerForm() {
  const [state, action] = useActionState(registerOwner, initialActionState);

  return (
    <form action={action} className="grid gap-4">
      <FormError state={state} />
      <Field
        autoComplete="name"
        label="Owner name"
        name="name"
        placeholder="Raees Ahmed"
      />
      <Field
        autoComplete="email"
        label="Email"
        name="email"
        placeholder="owner@example.com"
        type="email"
      />
      <Field
        autoComplete="new-password"
        label="Password"
        minLength={8}
        name="password"
        placeholder="Minimum 8 characters"
        type="password"
      />
      <SubmitButton pendingLabel="Creating account...">
        Create owner account
      </SubmitButton>
    </form>
  );
}

export function LoginOwnerForm() {
  const [state, action] = useActionState(loginOwner, initialActionState);

  return (
    <form action={action} className="grid gap-4">
      <FormError state={state} />
      <Field
        autoComplete="email"
        label="Email"
        name="email"
        placeholder="owner@example.com"
        type="email"
      />
      <Field
        autoComplete="current-password"
        label="Password"
        name="password"
        type="password"
      />
      <SubmitButton pendingLabel="Signing in...">Sign in</SubmitButton>
    </form>
  );
}
