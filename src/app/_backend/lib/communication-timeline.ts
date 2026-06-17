import "server-only";

import type { CommunicationTimelineEntry } from "@/app/_frontend/components/dashboard/communication-timeline";

type TimelineEmail = {
  ccEmail: string | null;
  createdBy?: {
    email: string;
    name: string;
  } | null;
  errorMessage: string | null;
  id: string;
  preparedAt: Date;
  providerMessageId: string | null;
  recipientEmail: string;
  sentAt: Date | null;
  status: string;
  subject: string;
  updatedAt: Date;
};

type TimelinePayment = {
  amount: unknown;
  createdAt: Date;
  id: string;
  notes: string | null;
  paymentDate: Date;
  paymentMethod: string;
};

type TimelineRefund = {
  amount: unknown;
  createdAt: Date;
  id: string;
  items: Array<{
    itemName: string;
    quantity: unknown;
    refundAmount: unknown;
    restockQuantity: unknown;
  }>;
  notes: string | null;
  reason: string | null;
  refundDate: Date;
  refundMethod: string;
  refundNumber: string;
  status: string;
};

type TimelineCommunicationNote = {
  body: string;
  createdAt: Date;
  createdBy?: {
    email: string;
    name: string;
  } | null;
  followUpAt: Date | null;
  id: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
  } | null;
  type: string;
  updatedAt: Date;
};

type TimelineInvoice = {
  communicationNotes?: TimelineCommunicationNote[];
  createdAt: Date;
  emailSends: TimelineEmail[];
  id: string;
  invoiceNumber: string;
  notes: string | null;
  payments: TimelinePayment[];
  refunds?: TimelineRefund[];
  updatedAt: Date;
};

type TimelineCustomer = {
  communicationNotes: TimelineCommunicationNote[];
  createdAt: Date;
  id: string;
  invoices: TimelineInvoice[];
  name: string;
  notes: string | null;
  updatedAt: Date;
};

function moneyText(value: unknown, currency: string) {
  return new Intl.NumberFormat("en-PK", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value));
}

function methodLabel(value: string) {
  return value.replace(/_/g, " ");
}

function userLabel(user: TimelineEmail["createdBy"]) {
  return user?.name || user?.email || "Unknown user";
}

function dateText(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function communicationType(value: string): CommunicationTimelineEntry["type"] {
  if (value === "call") {
    return "call";
  }

  if (value === "whatsapp") {
    return "whatsapp";
  }

  if (value === "email") {
    return "email";
  }

  if (value === "follow_up") {
    return "follow_up";
  }

  return "note";
}

function communicationTone(value: string): CommunicationTimelineEntry["tone"] {
  if (value === "follow_up") {
    return "amber";
  }

  if (value === "call" || value === "whatsapp" || value === "email") {
    return "blue";
  }

  return "neutral";
}

function communicationTitle(value: string) {
  if (value === "call") {
    return "Call note";
  }

  if (value === "whatsapp") {
    return "WhatsApp note";
  }

  if (value === "email") {
    return "Email note";
  }

  if (value === "follow_up") {
    return "Follow-up note";
  }

  return "Manual note";
}

function emailStatusTone(status: string): CommunicationTimelineEntry["tone"] {
  if (status === "sent") {
    return "green";
  }

  if (status === "failed") {
    return "red";
  }

  if (status === "sending") {
    return "blue";
  }

  return "amber";
}

function emailMetadata(email: TimelineEmail) {
  return [
    `To ${email.recipientEmail}`,
    email.ccEmail ? `CC ${email.ccEmail}` : null,
    `Prepared by ${userLabel(email.createdBy)}`,
    email.providerMessageId ? `Message ${email.providerMessageId}` : null,
  ].filter((item): item is string => Boolean(item));
}

function invoiceHref(invoiceId: string) {
  return `/dashboard/invoices/${invoiceId}`;
}

function addInvoiceEmailEntries(
  entries: CommunicationTimelineEntry[],
  invoice: TimelineInvoice,
) {
  for (const email of invoice.emailSends) {
    entries.push({
      description: `Subject: ${email.subject}`,
      href: invoiceHref(invoice.id),
      id: `email-prepared-${email.id}`,
      metadata: emailMetadata(email),
      occurredAt: email.preparedAt,
      title: `Email prepared for ${invoice.invoiceNumber}`,
      tone: "amber",
      type: "email",
    });

    if (email.status === "sent" && email.sentAt) {
      entries.push({
        description: `Invoice email was sent to ${email.recipientEmail}.`,
        href: invoiceHref(invoice.id),
        id: `email-sent-${email.id}`,
        metadata: emailMetadata(email),
        occurredAt: email.sentAt,
        title: `Email sent for ${invoice.invoiceNumber}`,
        tone: "green",
        type: "email",
      });
    } else if (email.status === "failed") {
      entries.push({
        description:
          email.errorMessage ||
          `Invoice email to ${email.recipientEmail} failed.`,
        href: invoiceHref(invoice.id),
        id: `email-failed-${email.id}`,
        metadata: emailMetadata(email),
        occurredAt: email.updatedAt,
        title: `Email failed for ${invoice.invoiceNumber}`,
        tone: "red",
        type: "email",
      });
    } else if (email.status === "sending") {
      entries.push({
        description: `Invoice email is currently being sent to ${email.recipientEmail}.`,
        href: invoiceHref(invoice.id),
        id: `email-sending-${email.id}`,
        metadata: emailMetadata(email),
        occurredAt: email.updatedAt,
        title: `Email sending for ${invoice.invoiceNumber}`,
        tone: "blue",
        type: "email",
      });
    } else if (email.status !== "prepared") {
      entries.push({
        description: `Invoice email status changed to ${email.status}.`,
        href: invoiceHref(invoice.id),
        id: `email-status-${email.id}`,
        metadata: emailMetadata(email),
        occurredAt: email.updatedAt,
        title: `Email ${email.status} for ${invoice.invoiceNumber}`,
        tone: emailStatusTone(email.status),
        type: "email",
      });
    }
  }
}

function addInvoicePaymentEntries(
  entries: CommunicationTimelineEntry[],
  invoice: TimelineInvoice,
  currency: string,
) {
  for (const payment of invoice.payments) {
    entries.push({
      description: payment.notes
        ? `${methodLabel(payment.paymentMethod)} payment. Note: ${payment.notes}`
        : `${methodLabel(payment.paymentMethod)} payment recorded.`,
      href: invoiceHref(invoice.id),
      id: `payment-${payment.id}`,
      metadata: [
        `Invoice ${invoice.invoiceNumber}`,
        moneyText(payment.amount, currency),
      ],
      occurredAt: payment.paymentDate,
      title: `Payment received for ${invoice.invoiceNumber}`,
      tone: "green",
      type: "payment",
    });
  }
}

function addInvoiceRefundEntries(
  entries: CommunicationTimelineEntry[],
  invoice: TimelineInvoice,
  currency: string,
) {
  for (const refund of invoice.refunds ?? []) {
    const returnedItems = refund.items
      .map(
        (item) =>
          `${item.itemName} x ${Number(item.quantity).toFixed(2)} (${moneyText(
            item.refundAmount,
            currency,
          )})`,
      )
      .join(", ");
    const restockedQuantity = refund.items.reduce(
      (total, item) => total + Number(item.restockQuantity),
      0,
    );

    entries.push({
      description:
        refund.notes ||
        refund.reason ||
        (returnedItems
          ? `Returned items: ${returnedItems}`
          : "Refund recorded."),
      href: invoiceHref(invoice.id),
      id: `refund-${refund.id}`,
      metadata: [
        `Invoice ${invoice.invoiceNumber}`,
        `Refund ${refund.refundNumber}`,
        moneyText(refund.amount, currency),
        methodLabel(refund.refundMethod),
        restockedQuantity > 0
          ? `Restocked ${restockedQuantity.toFixed(2)} units`
          : null,
      ].filter((item): item is string => Boolean(item)),
      occurredAt: refund.refundDate,
      title: `Refund recorded for ${invoice.invoiceNumber}`,
      tone: "red",
      type: "refund",
    });
  }
}

function addInvoiceNoteEntry(
  entries: CommunicationTimelineEntry[],
  invoice: TimelineInvoice,
) {
  if (!invoice.notes) {
    return;
  }

  entries.push({
    description: invoice.notes,
    href: invoiceHref(invoice.id),
    id: `invoice-note-${invoice.id}`,
    metadata: [`Invoice ${invoice.invoiceNumber}`],
    occurredAt: invoice.updatedAt,
    title: `Invoice note for ${invoice.invoiceNumber}`,
    tone: "neutral",
    type: "note",
  });
}

function addManualCommunicationNotes(
  entries: CommunicationTimelineEntry[],
  notes: TimelineCommunicationNote[],
  fallbackHref?: string,
) {
  for (const note of notes) {
    const href =
      note.invoice?.id ? invoiceHref(note.invoice.id) : fallbackHref;
    const metadata = [
      `Added by ${userLabel(note.createdBy)}`,
      note.invoice ? `Invoice ${note.invoice.invoiceNumber}` : null,
      note.followUpAt ? `Follow-up ${dateText(note.followUpAt)}` : null,
    ].filter((item): item is string => Boolean(item));

    entries.push({
      description: note.body,
      href,
      id: `manual-note-${note.id}`,
      metadata,
      occurredAt: note.createdAt,
      title: note.invoice
        ? `${communicationTitle(note.type)} for ${note.invoice.invoiceNumber}`
        : communicationTitle(note.type),
      tone: communicationTone(note.type),
      type: communicationType(note.type),
    });
  }
}

export function buildInvoiceCommunicationTimeline(
  invoice: TimelineInvoice,
  currency: string,
) {
  const entries: CommunicationTimelineEntry[] = [];

  addInvoiceEmailEntries(entries, invoice);
  addInvoicePaymentEntries(entries, invoice, currency);
  addInvoiceRefundEntries(entries, invoice, currency);
  addInvoiceNoteEntry(entries, invoice);
  addManualCommunicationNotes(
    entries,
    invoice.communicationNotes ?? [],
    invoiceHref(invoice.id),
  );

  return entries;
}

export function buildCustomerCommunicationTimeline(
  customer: TimelineCustomer,
  currency: string,
) {
  const entries: CommunicationTimelineEntry[] = [];

  if (customer.notes) {
    entries.push({
      description: customer.notes,
      href: `/dashboard/customers/${customer.id}`,
      id: `customer-note-${customer.id}`,
      metadata: [`Customer ${customer.name}`],
      occurredAt: customer.updatedAt,
      title: "Customer note",
      tone: "neutral",
      type: "note",
    });
  }

  addManualCommunicationNotes(
    entries,
    customer.communicationNotes,
    `/dashboard/customers/${customer.id}`,
  );

  for (const invoice of customer.invoices) {
    addInvoiceEmailEntries(entries, invoice);
    addInvoicePaymentEntries(entries, invoice, currency);
    addInvoiceRefundEntries(entries, invoice, currency);
    addInvoiceNoteEntry(entries, invoice);
  }

  return entries;
}
