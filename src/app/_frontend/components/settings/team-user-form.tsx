"use client";

import { useActionState } from "react";

import {
  createTeamUser,
  type SettingsActionState,
} from "@/app/dashboard/settings/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";

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

export function TeamUserForm() {
  const [state, action] = useActionState(createTeamUser, initialState);

  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <label className="grid gap-2 text-sm font-medium">
        Name
        <input
          autoComplete="name"
          className="h-11 rounded-lg border border-white/80 bg-white/70 px-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(36,42,94,0.04)] outline-none transition placeholder:text-[#a4acc0] focus:border-[#635bff]/40 focus:bg-white focus:ring-2 focus:ring-[#635bff]/10"
          name="name"
          placeholder="Team member name"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="h-11 rounded-lg border border-white/80 bg-white/70 px-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(36,42,94,0.04)] outline-none transition placeholder:text-[#a4acc0] focus:border-[#635bff]/40 focus:bg-white focus:ring-2 focus:ring-[#635bff]/10"
          name="email"
          placeholder="member@example.com"
          required
          type="email"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Temporary password
        <input
          autoComplete="new-password"
          className="h-11 rounded-lg border border-white/80 bg-white/70 px-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(36,42,94,0.04)] outline-none transition placeholder:text-[#a4acc0] focus:border-[#635bff]/40 focus:bg-white focus:ring-2 focus:ring-[#635bff]/10"
          minLength={8}
          name="password"
          placeholder="Minimum 8 characters"
          required
          type="password"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Role
        <select
          className="h-11 rounded-lg border border-white/80 bg-white/70 px-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-[#635bff]/40 focus:bg-white focus:ring-2 focus:ring-[#635bff]/10"
          defaultValue="staff"
          name="role"
          required
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <SubmitButton pendingLabel="Creating user...">
        Create team user
      </SubmitButton>
    </form>
  );
}
