import "server-only";

import { decryptSecret, hasCompleteEmailSettings } from "@/app/_backend/lib/email-settings";
import { generateInvoicePdf } from "@/app/_backend/lib/invoice-pdf";
import { sendSmtpMail } from "@/app/_backend/lib/smtp-client";

type InvoiceDeliveryRecord = {
  body: string;
  ccEmail: string | null;
  recipientEmail: string;
  subject: string;
  invoice: Parameters<typeof generateInvoicePdf>[0];
};

type BusinessEmailSettingInput = {
  fromEmail: string;
  fromName: string;
  replyToEmail: string | null;
  smtpHost: string;
  smtpPasswordEncrypted: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string | null;
};

function splitEmailList(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function validateEmailDeliverySettings(
  settings: BusinessEmailSettingInput | null,
) {
  if (!settings || !hasCompleteEmailSettings(settings)) {
    return "Configure SMTP host, port, and from email in Settings before sending invoices.";
  }

  if (
    (settings.smtpUsername || settings.smtpPasswordEncrypted) &&
    !settings.smtpPasswordEncrypted
  ) {
    return "SMTP username is set, but no password is saved.";
  }

  return null;
}

export async function deliverInvoiceEmail({
  currency,
  emailRecord,
  settings,
}: {
  currency: string;
  emailRecord: InvoiceDeliveryRecord;
  settings: BusinessEmailSettingInput;
}) {
  const password = settings.smtpPasswordEncrypted
    ? decryptSecret(settings.smtpPasswordEncrypted)
    : null;
  const pdf = generateInvoicePdf(emailRecord.invoice, currency);

  return sendSmtpMail(
    {
      host: settings.smtpHost,
      password,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      username: settings.smtpUsername,
    },
    {
      attachments: [
        {
          content: pdf,
          contentType: "application/pdf",
          filename: `${emailRecord.invoice.invoiceNumber}.pdf`,
        },
      ],
      body: emailRecord.body,
      cc: splitEmailList(emailRecord.ccEmail),
      from: {
        email: settings.fromEmail,
        name: settings.fromName,
      },
      replyTo: settings.replyToEmail,
      subject: emailRecord.subject,
      to: [emailRecord.recipientEmail],
    },
  );
}
