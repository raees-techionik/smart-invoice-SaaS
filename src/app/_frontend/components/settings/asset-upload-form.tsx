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
          className="h-11 rounded-lg border border-white/80 bg-white/70 px-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-[#635bff]/40 focus:bg-white focus:ring-2 focus:ring-[#635bff]/10"
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
          className="rounded-lg border border-dashed border-[#635bff]/25 bg-white/65 px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-[#eeecff] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#5147d9] focus:border-[#635bff]/40 focus:bg-white focus:ring-2 focus:ring-[#635bff]/10"
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
