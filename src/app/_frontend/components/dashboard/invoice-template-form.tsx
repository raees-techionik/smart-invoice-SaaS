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
        className="min-h-20 rounded-[7px] border border-border bg-white px-2.5 py-2 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
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
        className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] capitalize outline-none transition focus:border-accent"
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
    <label className="flex items-center gap-2 text-sm font-medium">
      <input defaultChecked={defaultChecked} name={name} type="checkbox" />
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
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
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

      <div className="grid gap-4 md:grid-cols-3">
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
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] outline-none transition placeholder:text-muted-foreground/70 focus:border-accent"
            defaultValue={settings?.signatureLabel ?? "Authorized signature"}
            name="signatureLabel"
            placeholder="Authorized signature"
          />
        </label>
      </div>

      <fieldset className="grid gap-3 rounded-[10px] border border-border bg-[#f8f9fa] p-3">
        <legend className="px-1 text-sm font-semibold">Accent color</legend>
        <div className="flex flex-wrap gap-3">
          {invoiceTemplateAccentColors.map((color) => (
            <label
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium"
              key={color}
            >
              <input
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

      <div className="grid gap-3 rounded-[10px] border border-border bg-[#f8f9fa] p-3">
        <div className="grid gap-3 md:grid-cols-4">
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

        <div className="grid gap-4 md:grid-cols-3">
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

      <div className="grid gap-3 rounded-[10px] border border-border bg-[#f8f9fa] p-3 md:grid-cols-2">
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
