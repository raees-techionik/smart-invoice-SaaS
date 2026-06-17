import "server-only";

import { parseInvoiceTemplateSettings } from "@/app/_backend/lib/invoice-templates";

type InvoiceEmailInput = {
  business: {
    email: string | null;
    name: string;
    phone: string | null;
  };
  customer: {
    businessName: string | null;
    email: string | null;
    name: string;
  } | null;
  dueDate: Date | null;
  grandTotal: unknown;
  invoiceDate: Date;
  invoiceNumber: string;
  items: Array<{
    itemName: string;
    lineTotal: unknown;
    quantity: unknown;
  }>;
  balanceAmount: unknown;
  template: {
    settings: string | null;
  } | null;
};

function currencyFormatter(currency: string) {
  return new Intl.NumberFormat("en-PK", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  });
}

function dateFormatter(date: Date | null) {
  if (!date) {
    return "not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function decimalText(value: unknown) {
  const numberValue = Number(value);

  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(2);
}

export function buildInvoiceEmailContent(
  invoice: InvoiceEmailInput,
  currency: string,
) {
  const money = currencyFormatter(currency);
  const templateSettings = parseInvoiceTemplateSettings(
    invoice.template?.settings,
  );
  const customerName =
    invoice.customer?.businessName || invoice.customer?.name || "Customer";
  const subject = `Invoice ${invoice.invoiceNumber} from ${invoice.business.name}`;
  const lineItems = invoice.items
    .map(
      (item) =>
        `- ${item.itemName} x ${decimalText(item.quantity)}: ${money.format(
          Number(item.lineTotal),
        )}`,
    )
    .join("\n");
  const paymentInstructions = templateSettings.paymentInstructions
    ? `\n\nPayment instructions:\n${templateSettings.paymentInstructions}`
    : "";
  const businessContact = [invoice.business.email, invoice.business.phone]
    .filter(Boolean)
    .join(" / ");
  const contactLine = businessContact
    ? `\n\nFor questions, contact ${businessContact}.`
    : "";

  return {
    body: `Dear ${customerName},

Please find invoice ${invoice.invoiceNumber} from ${invoice.business.name}.

Invoice date: ${dateFormatter(invoice.invoiceDate)}
Due date: ${dateFormatter(invoice.dueDate)}
Grand total: ${money.format(Number(invoice.grandTotal))}
Balance due: ${money.format(Number(invoice.balanceAmount))}

Items:
${lineItems || "- No line items"}
${paymentInstructions}${contactLine}

Regards,
${invoice.business.name}`,
    subject,
  };
}
