export const invoiceTemplateLayouts = ["classic", "modern", "compact"] as const;
export const invoiceTemplateHeaderStyles = ["stacked", "split", "boxed"] as const;
export const invoiceTemplateDensityOptions = ["comfortable", "compact"] as const;
export const invoiceTemplateLogoPlacements = ["left", "right", "hidden"] as const;
export const invoiceTemplateSignaturePlacements = ["left", "right", "hidden"] as const;
export const invoiceTemplateStampPlacements = ["near_signature", "right", "hidden"] as const;

export type InvoiceTemplateLayout = (typeof invoiceTemplateLayouts)[number];
export type InvoiceTemplateHeaderStyle =
  (typeof invoiceTemplateHeaderStyles)[number];
export type InvoiceTemplateDensity =
  (typeof invoiceTemplateDensityOptions)[number];
export type InvoiceTemplateLogoPlacement =
  (typeof invoiceTemplateLogoPlacements)[number];
export type InvoiceTemplateSignaturePlacement =
  (typeof invoiceTemplateSignaturePlacements)[number];
export type InvoiceTemplateStampPlacement =
  (typeof invoiceTemplateStampPlacements)[number];

export type InvoiceTemplateSettings = {
  accentColor: string;
  defaultNotes: string;
  defaultTerms: string;
  density: InvoiceTemplateDensity;
  footerText: string;
  headerStyle: InvoiceTemplateHeaderStyle;
  layout: InvoiceTemplateLayout;
  logoPlacement: InvoiceTemplateLogoPlacement;
  paymentInstructions: string;
  showBalanceBox: boolean;
  showBusinessTaxNumber: boolean;
  showCustomerContacts: boolean;
  showItemDescriptions: boolean;
  showLogo: boolean;
  showSignature: boolean;
  showStamp: boolean;
  signatureLabel: string;
  signaturePlacement: InvoiceTemplateSignaturePlacement;
  stampPlacement: InvoiceTemplateStampPlacement;
};

export const invoiceTemplateAccentColors = [
  "#0f8b6d",
  "#2563eb",
  "#7c3aed",
  "#111827",
  "#dc2626",
  "#c08a2d",
] as const;

export const defaultInvoiceTemplateSettings: InvoiceTemplateSettings = {
  accentColor: invoiceTemplateAccentColors[0],
  defaultNotes: "",
  defaultTerms: "",
  density: "comfortable",
  footerText: "",
  headerStyle: "split",
  layout: "classic",
  logoPlacement: "left",
  paymentInstructions: "",
  showBalanceBox: true,
  showBusinessTaxNumber: true,
  showCustomerContacts: true,
  showItemDescriptions: true,
  showLogo: true,
  showSignature: true,
  showStamp: true,
  signatureLabel: "Authorized signature",
  signaturePlacement: "left",
  stampPlacement: "near_signature",
};

export function isInvoiceTemplateLayout(
  value: string,
): value is InvoiceTemplateLayout {
  return invoiceTemplateLayouts.includes(value as InvoiceTemplateLayout);
}

function enumValue<T extends readonly string[]>(
  allowedValues: T,
  value: unknown,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && allowedValues.includes(value)
    ? value
    : fallback;
}

export function safeTemplateAccentColor(value: string) {
  return invoiceTemplateAccentColors.includes(
    value as (typeof invoiceTemplateAccentColors)[number],
  )
    ? value
    : defaultInvoiceTemplateSettings.accentColor;
}

export function parseInvoiceTemplateSettings(
  settings?: string | null,
): InvoiceTemplateSettings {
  if (!settings) {
    return { ...defaultInvoiceTemplateSettings };
  }

  try {
    const parsed = JSON.parse(settings) as Partial<InvoiceTemplateSettings>;
    const layout =
      typeof parsed.layout === "string" && isInvoiceTemplateLayout(parsed.layout)
        ? parsed.layout
        : defaultInvoiceTemplateSettings.layout;
    const accentColor =
      typeof parsed.accentColor === "string"
        ? safeTemplateAccentColor(parsed.accentColor)
        : defaultInvoiceTemplateSettings.accentColor;

    return {
      accentColor,
      defaultNotes:
        typeof parsed.defaultNotes === "string" ? parsed.defaultNotes : "",
      defaultTerms:
        typeof parsed.defaultTerms === "string" ? parsed.defaultTerms : "",
      density: enumValue(
        invoiceTemplateDensityOptions,
        parsed.density,
        defaultInvoiceTemplateSettings.density,
      ),
      footerText: typeof parsed.footerText === "string" ? parsed.footerText : "",
      headerStyle: enumValue(
        invoiceTemplateHeaderStyles,
        parsed.headerStyle,
        defaultInvoiceTemplateSettings.headerStyle,
      ),
      layout,
      logoPlacement: enumValue(
        invoiceTemplateLogoPlacements,
        parsed.logoPlacement,
        parsed.showLogo === false
          ? "hidden"
          : defaultInvoiceTemplateSettings.logoPlacement,
      ),
      paymentInstructions:
        typeof parsed.paymentInstructions === "string"
          ? parsed.paymentInstructions
          : "",
      showBalanceBox:
        typeof parsed.showBalanceBox === "boolean"
          ? parsed.showBalanceBox
          : defaultInvoiceTemplateSettings.showBalanceBox,
      showBusinessTaxNumber:
        typeof parsed.showBusinessTaxNumber === "boolean"
          ? parsed.showBusinessTaxNumber
          : defaultInvoiceTemplateSettings.showBusinessTaxNumber,
      showCustomerContacts:
        typeof parsed.showCustomerContacts === "boolean"
          ? parsed.showCustomerContacts
          : defaultInvoiceTemplateSettings.showCustomerContacts,
      showItemDescriptions:
        typeof parsed.showItemDescriptions === "boolean"
          ? parsed.showItemDescriptions
          : defaultInvoiceTemplateSettings.showItemDescriptions,
      showLogo:
        typeof parsed.showLogo === "boolean"
          ? parsed.showLogo
          : defaultInvoiceTemplateSettings.showLogo,
      showSignature:
        typeof parsed.showSignature === "boolean"
          ? parsed.showSignature
          : defaultInvoiceTemplateSettings.showSignature,
      showStamp:
        typeof parsed.showStamp === "boolean"
          ? parsed.showStamp
          : defaultInvoiceTemplateSettings.showStamp,
      signatureLabel:
        typeof parsed.signatureLabel === "string"
          ? parsed.signatureLabel
          : defaultInvoiceTemplateSettings.signatureLabel,
      signaturePlacement: enumValue(
        invoiceTemplateSignaturePlacements,
        parsed.signaturePlacement,
        parsed.showSignature === false
          ? "hidden"
          : defaultInvoiceTemplateSettings.signaturePlacement,
      ),
      stampPlacement: enumValue(
        invoiceTemplateStampPlacements,
        parsed.stampPlacement,
        parsed.showStamp === false
          ? "hidden"
          : defaultInvoiceTemplateSettings.stampPlacement,
      ),
    };
  } catch {
    return { ...defaultInvoiceTemplateSettings };
  }
}

export function stringifyInvoiceTemplateSettings(
  settings: InvoiceTemplateSettings,
) {
  return JSON.stringify(settings);
}
