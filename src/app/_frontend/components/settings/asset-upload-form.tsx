"use client";

import { useActionState } from "react";

import {
  uploadBusinessAsset,
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

export function AssetUploadForm() {
  const [state, action] = useActionState(uploadBusinessAsset, initialState);

  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <label className="grid gap-2 text-sm font-medium">
        Asset type
        <select
          className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          name="assetType"
          required
        >
          <option value="logo">Logo</option>
          <option value="signature">Signature</option>
          <option value="stamp">Stamp</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Image file
        <input
          accept="image/jpeg,image/png,image/svg+xml,image/webp"
          className="rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-semibold focus:border-accent focus:ring-2 focus:ring-accent/15"
          name="asset"
          required
          type="file"
        />
      </label>
      <p className="text-sm leading-6 text-muted-foreground">
        JPG, PNG, SVG, or WebP. Maximum size 2 MB.
      </p>
      <div>
        <SubmitButton pendingLabel="Uploading asset...">
          Upload asset
        </SubmitButton>
      </div>
    </form>
  );
}
