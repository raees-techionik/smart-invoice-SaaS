"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createInvoiceTemplate,
  type InvoiceTemplateActionState,
  updateInvoiceTemplate,
} from "@/app/dashboard/templates/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";
import {
  invoiceTemplateAccentColors,
  invoiceTemplateDensityOptions,
  invoiceTemplateHeaderStyles,
  invoiceTemplateLayouts,
  invoiceTemplateLogoPlacements,
  invoiceTemplateSignaturePlacements,
  invoiceTemplateStampPlacements,
  type InvoiceTemplateSettings,
} from "@/app/_backend/lib/invoice-templates";

const initialState: InvoiceTemplateActionState = {};

type InvoiceTemplateFormProps = {
  defaults?: {
    id?: string;
    isDefault: boolean;
    name: string;
    settings: InvoiceTemplateSettings;
  };
  submitLabel?: string;
};

function FormMessage({ state }: { state: InvoiceTemplateActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
        {state.success}
      </p>
    );
  }

  return null;
}

function TextareaField({
  defaultValue,
  label,
  name,
  placeholder,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}
      <textarea
        className="min-h-20 rounded-lg border border-white/80 bg-white/70 px-3 py-2 text-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition placeholder:text-muted-foreground/70 focus:border-[#635bff]/40 focus:ring-2 focus:ring-[#635bff]/10"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue: string;
  label: string;
  name: string;
  options: readonly string[];
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}
      <select
        className="h-[34px] rounded-lg border border-white/80 bg-white/70 px-3 text-[12px] capitalize shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-[#635bff]/40 focus:ring-2 focus:ring-[#635bff]/10"
        defaultValue={defaultValue}
        name={name}
      >
        {options.map((option) => (
          <option className="capitalize" key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  defaultChecked,
  label,
  name,
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-white/70 bg-white/55 px-3 py-2 text-sm font-medium shadow-[0_8px_18px_rgba(36,42,94,0.05)]">
      <input
        className="size-4 accent-[#635bff]"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      {label}
    </label>
  );
}

export function InvoiceTemplateForm({
  defaults,
  submitLabel = "Save template",
}: InvoiceTemplateFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const actionHandler = defaults?.id
    ? updateInvoiceTemplate
    : createInvoiceTemplate;
  const [state, action] = useActionState(actionHandler, initialState);
  const settings = defaults?.settings;

  useEffect(() => {
    if (state.success && !defaults?.id) {
      formRef.current?.reset();
    }
  }, [defaults?.id, state.success]);

  return (
    <form action={action} className="grid gap-5" ref={formRef}>
      {defaults?.id ? (
        <input name="templateId" type="hidden" value={defaults.id} />
      ) : null}
      <FormMessage state={state} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Template name
          <input
            className="h-[34px] rounded-lg border border-white/80 bg-white/70 px-3 text-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition placeholder:text-muted-foreground/70 focus:border-[#635bff]/40 focus:ring-2 focus:ring-[#635bff]/10"
            defaultValue={defaults?.name}
            name="name"
            placeholder="Standard invoice, Retail tax invoice..."
            required
          />
        </label>
        <SelectField
          defaultValue={settings?.layout ?? "classic"}
          label="Layout"
          name="layout"
          options={invoiceTemplateLayouts}
        />
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        <SelectField
          defaultValue={settings?.headerStyle ?? "split"}
          label="Header style"
          name="headerStyle"
          options={invoiceTemplateHeaderStyles}
        />
        <SelectField
          defaultValue={settings?.density ?? "comfortable"}
          label="Line density"
          name="density"
          options={invoiceTemplateDensityOptions}
        />
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Signature label
          <input
            className="h-[34px] rounded-lg border border-white/80 bg-white/70 px-3 text-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition placeholder:text-muted-foreground/70 focus:border-[#635bff]/40 focus:ring-2 focus:ring-[#635bff]/10"
            defaultValue={settings?.signatureLabel ?? "Authorized signature"}
            name="signatureLabel"
            placeholder="Authorized signature"
          />
        </label>
      </div>

      <fieldset className="grid gap-3 rounded-[12px] border border-white/70 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <legend className="px-1 text-sm font-semibold">Accent color</legend>
        <div className="flex flex-wrap gap-3">
          {invoiceTemplateAccentColors.map((color) => (
            <label
              className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/70 px-3 py-2 text-sm font-medium shadow-[0_8px_18px_rgba(36,42,94,0.05)]"
              key={color}
            >
              <input
                className="accent-[#635bff]"
                defaultChecked={(settings?.accentColor ?? "#0f8b6d") === color}
                name="accentColor"
                type="radio"
                value={color}
              />
              <span
                className="size-5 rounded-full border border-black/10"
                style={{ backgroundColor: color }}
              />
              {color}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 rounded-[12px] border border-white/70 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <ToggleField
            defaultChecked={settings?.showLogo ?? true}
            label="Show business logo"
            name="showLogo"
          />
          <ToggleField
            defaultChecked={settings?.showSignature ?? true}
            label="Show signature"
            name="showSignature"
          />
          <ToggleField
            defaultChecked={settings?.showStamp ?? true}
            label="Show stamp"
            name="showStamp"
          />
          <ToggleField
            defaultChecked={defaults?.isDefault ?? false}
            label="Use as default template"
            name="isDefault"
          />
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          <SelectField
            defaultValue={settings?.logoPlacement ?? "left"}
            label="Logo placement"
            name="logoPlacement"
            options={invoiceTemplateLogoPlacements}
          />
          <SelectField
            defaultValue={settings?.signaturePlacement ?? "left"}
            label="Signature placement"
            name="signaturePlacement"
            options={invoiceTemplateSignaturePlacements}
          />
          <SelectField
            defaultValue={settings?.stampPlacement ?? "near_signature"}
            label="Stamp placement"
            name="stampPlacement"
            options={invoiceTemplateStampPlacements}
          />
        </div>
      </div>

      <div className="grid gap-3 rounded-[12px] border border-white/70 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] md:grid-cols-2">
        <ToggleField
          defaultChecked={settings?.showBalanceBox ?? true}
          label="Show amount-due box"
          name="showBalanceBox"
        />
        <ToggleField
          defaultChecked={settings?.showItemDescriptions ?? true}
          label="Show item descriptions"
          name="showItemDescriptions"
        />
        <ToggleField
          defaultChecked={settings?.showBusinessTaxNumber ?? true}
          label="Show business tax number"
          name="showBusinessTaxNumber"
        />
        <ToggleField
          defaultChecked={settings?.showCustomerContacts ?? true}
          label="Show customer contact details"
          name="showCustomerContacts"
        />
      </div>

      <TextareaField
        defaultValue={settings?.defaultTerms}
        label="Default terms"
        name="defaultTerms"
        placeholder="Payment due within 7 days..."
      />
      <TextareaField
        defaultValue={settings?.defaultNotes}
        label="Default notes"
        name="defaultNotes"
        placeholder="Thank you for your business."
      />
      <TextareaField
        defaultValue={settings?.paymentInstructions}
        label="Payment instructions"
        name="paymentInstructions"
        placeholder="Bank account, mobile wallet, cheque instructions..."
      />
      <TextareaField
        defaultValue={settings?.footerText}
        label="Footer text"
        name="footerText"
        placeholder="Registered address, tax note, support contact..."
      />

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving template...">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
