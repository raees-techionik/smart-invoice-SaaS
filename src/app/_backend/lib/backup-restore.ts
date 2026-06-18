import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/app/_backend/lib/db/prisma";

type BackupRecord = Record<string, unknown>;

type BusinessBackup = {
  backupVersion?: unknown;
  business?: BackupRecord | null;
  businessEmailSetting?: BackupRecord | null;
  communicationNotes?: BackupRecord[];
  customers?: BackupRecord[];
  documentFieldMappings?: BackupRecord[];
  expenses?: BackupRecord[];
  importedDocuments?: Array<BackupRecord & { fields?: BackupRecord[] }>;
  importJobs?: Array<BackupRecord & { errors?: BackupRecord[] }>;
  inventoryMovements?: BackupRecord[];
  invoiceEmails?: BackupRecord[];
  invoiceTemplates?: BackupRecord[];
  invoices?: Array<BackupRecord & { items?: BackupRecord[] }>;
  payments?: BackupRecord[];
  products?: BackupRecord[];
  refunds?: Array<BackupRecord & { items?: BackupRecord[] }>;
};

type RestoreCounter = {
  created: number;
  skipped: number;
  updated: number;
};

export type BackupRestorePreview = {
  backupVersion: number;
  exportedAt: string | null;
  sourceBusinessName: string | null;
  counts: Record<string, number>;
  warnings: string[];
};

export type BackupRestoreResult = BackupRestorePreview & {
  restored: Record<string, RestoreCounter>;
};

const supportedBackupVersion = 3;

const restoreSections = [
  "customers",
  "products",
  "invoiceTemplates",
  "invoices",
  "payments",
  "refunds",
  "expenses",
  "inventoryMovements",
  "communicationNotes",
  "invoiceEmails",
  "importJobs",
  "importedDocuments",
  "documentFieldMappings",
] as const;

function emptyCounter(): RestoreCounter {
  return {
    created: 0,
    skipped: 0,
    updated: 0,
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  const text = stringValue(value);

  return text || null;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function decimalValue(value: unknown, fallback = "0") {
  const text = String(value ?? "").trim();
  const number = Number(text);

  return Number.isFinite(number) ? text : fallback;
}

function dateValue(value: unknown, fallback = new Date()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const text = typeof value === "string" || typeof value === "number" ? value : "";
  const date = new Date(text);

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function nullableDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  const date = dateValue(value, new Date(Number.NaN));

  return Number.isNaN(date.getTime()) ? null : date;
}

function arrayValue(value: unknown): BackupRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is BackupRecord =>
          typeof row === "object" && row !== null && !Array.isArray(row),
      )
    : [];
}

function oldId(row: BackupRecord) {
  return stringValue(row.id);
}

function parseBackupJson(jsonText: string): BusinessBackup & {
  exportedAt?: unknown;
} {
  const parsed = JSON.parse(jsonText) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Backup file must contain a JSON object.");
  }

  return parsed as BusinessBackup & { exportedAt?: unknown };
}

export function previewBusinessBackup(jsonText: string): BackupRestorePreview {
  const backup = parseBackupJson(jsonText);
  const backupVersion = numberValue(backup.backupVersion);

  if (backupVersion !== supportedBackupVersion) {
    throw new Error(
      `Backup restore requires Smart Invoice backup version ${supportedBackupVersion}.`,
    );
  }

  if (
    !backup.business ||
    typeof backup.business !== "object" ||
    !stringValue(backup.business.name)
  ) {
    throw new Error("Backup file does not contain a valid business profile.");
  }

  const warnings = [
    "Merge restore does not delete existing records.",
    "Users, passwords, SMTP passwords, sessions, and export audit history are not restored.",
    "Email settings are restored without the SMTP password and must be completed again before sending.",
    "Uploaded file binaries are not included in the JSON backup; stored file paths are restored as references only.",
  ];
  const counts = Object.fromEntries(
    restoreSections.map((section) => [section, arrayValue(backup[section]).length]),
  );
  const business =
    backup.business && typeof backup.business === "object" ? backup.business : null;

  return {
    backupVersion,
    counts,
    exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : null,
    sourceBusinessName: business ? nullableString(business.name) : null,
    warnings,
  };
}

async function mergeBusinessProfile(
  tx: Prisma.TransactionClient,
  businessId: string,
  business: BackupRecord | null | undefined,
) {
  if (!business) {
    return;
  }

  const current = await tx.business.findUniqueOrThrow({
    where: {
      id: businessId,
    },
  });
  const data: Prisma.BusinessUpdateInput = {};

  for (const field of [
    "ownerName",
    "phone",
    "email",
    "address",
    "taxNumber",
    "category",
    "defaultTerms",
    "defaultNotes",
    "logoPath",
    "signaturePath",
    "stampPath",
  ] as const) {
    if (!current[field] && nullableString(business[field])) {
      data[field] = nullableString(business[field]);
    }
  }

  if (current.currency === "PKR" && nullableString(business.currency)) {
    data.currency = nullableString(business.currency) ?? current.currency;
  }

  if (!current.isProfileComplete && typeof business.isProfileComplete === "boolean") {
    data.isProfileComplete = business.isProfileComplete;
  }

  if (Object.keys(data).length > 0) {
    await tx.business.update({
      data,
      where: {
        id: businessId,
      },
    });
  }
}

async function mergeBusinessEmailSetting(
  tx: Prisma.TransactionClient,
  businessId: string,
  setting: BackupRecord | null | undefined,
) {
  if (
    !setting ||
    !stringValue(setting.fromName) ||
    !stringValue(setting.fromEmail) ||
    !stringValue(setting.smtpHost)
  ) {
    return;
  }

  const data = {
    fromEmail: stringValue(setting.fromEmail),
    fromName: stringValue(setting.fromName),
    replyToEmail: nullableString(setting.replyToEmail),
    smtpHost: stringValue(setting.smtpHost),
    smtpPort: numberValue(setting.smtpPort, 587),
    smtpSecure: booleanValue(setting.smtpSecure),
    smtpUsername: nullableString(setting.smtpUsername),
  };
  const existing = await tx.businessEmailSetting.findUnique({
    where: {
      businessId,
    },
  });

  if (existing) {
    await tx.businessEmailSetting.update({
      data,
      where: {
        businessId,
      },
    });
    return;
  }

  await tx.businessEmailSetting.create({
    data: {
      ...data,
      businessId,
      createdAt: dateValue(setting.createdAt),
      smtpPasswordEncrypted: null,
    },
  });
}

async function restoreCustomers(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: BackupRecord[],
  idMap: Map<string, string>,
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const name = stringValue(row.name);

    if (!name) {
      counter.skipped += 1;
      continue;
    }

    const email = nullableString(row.email);
    const phone = nullableString(row.phone);
    const businessName = nullableString(row.businessName);
    const sourceId = oldId(row);
    const existing = await tx.customer.findFirst({
      where: {
        businessId,
        OR: [
          ...(sourceId ? [{ id: sourceId }] : []),
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
          {
            businessName,
            name,
          },
        ],
      },
    });
    const data = {
      address: nullableString(row.address),
      businessName,
      email,
      name,
      notes: nullableString(row.notes),
      openingBalance: decimalValue(row.openingBalance),
      phone,
      status: stringValue(row.status) || "active",
      taxNumber: nullableString(row.taxNumber),
    };

    if (existing) {
      await tx.customer.update({
        data,
        where: {
          id: existing.id,
        },
      });
      idMap.set(sourceId, existing.id);
      counter.updated += 1;
      continue;
    }

    const created = await tx.customer.create({
      data: {
        ...data,
        businessId,
        createdAt: dateValue(row.createdAt),
      },
    });
    idMap.set(sourceId, created.id);
    counter.created += 1;
  }
}

async function restoreProducts(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: BackupRecord[],
  idMap: Map<string, string>,
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const name = stringValue(row.name);

    if (!name) {
      counter.skipped += 1;
      continue;
    }

    const sku = nullableString(row.sku);
    const sourceId = oldId(row);
    const existing = await tx.product.findFirst({
      where: {
        businessId,
        OR: [
          ...(sourceId ? [{ id: sourceId }] : []),
          sku ? { sku } : { name },
        ],
      },
    });
    const data = {
      category: nullableString(row.category),
      costPrice: decimalValue(row.costPrice),
      description: nullableString(row.description),
      lowStockAlert: decimalValue(row.lowStockAlert),
      name,
      salePrice: decimalValue(row.salePrice),
      sku,
      status: stringValue(row.status) || "active",
      stockQuantity: decimalValue(row.stockQuantity),
      taxRate: decimalValue(row.taxRate),
      type: stringValue(row.type) || "product",
      unit: nullableString(row.unit),
    };

    if (existing) {
      await tx.product.update({
        data,
        where: {
          id: existing.id,
        },
      });
      idMap.set(sourceId, existing.id);
      counter.updated += 1;
      continue;
    }

    const created = await tx.product.create({
      data: {
        ...data,
        businessId,
        createdAt: dateValue(row.createdAt),
      },
    });
    idMap.set(sourceId, created.id);
    counter.created += 1;
  }
}

async function restoreTemplates(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: BackupRecord[],
  idMap: Map<string, string>,
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const name = stringValue(row.name);

    if (!name) {
      counter.skipped += 1;
      continue;
    }

    const sourceId = oldId(row);
    const existing = await tx.invoiceTemplate.findFirst({
      where: {
        businessId,
        OR: [
          ...(sourceId ? [{ id: sourceId }] : []),
          { name },
        ],
      },
    });
    const data = {
      isDefault: booleanValue(row.isDefault),
      name,
      settings: nullableString(row.settings),
    };

    if (existing) {
      await tx.invoiceTemplate.update({
        data,
        where: {
          id: existing.id,
        },
      });
      idMap.set(sourceId, existing.id);
      counter.updated += 1;
      continue;
    }

    const created = await tx.invoiceTemplate.create({
      data: {
        ...data,
        businessId,
        createdAt: dateValue(row.createdAt),
      },
    });
    idMap.set(sourceId, created.id);
    counter.created += 1;
  }
}

async function restoreInvoices(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: Array<BackupRecord & { items?: BackupRecord[] }>,
  maps: {
    customers: Map<string, string>;
    invoiceItems: Map<string, string>;
    invoices: Map<string, string>;
    products: Map<string, string>;
    templates: Map<string, string>;
  },
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const invoiceNumber = stringValue(row.invoiceNumber);

    if (!invoiceNumber) {
      counter.skipped += 1;
      continue;
    }

    const sourceId = oldId(row);
    const existing = await tx.invoice.findFirst({
      where: {
        businessId,
        OR: [
          ...(sourceId ? [{ id: sourceId }] : []),
          { invoiceNumber },
        ],
      },
    });
    const customerId = maps.customers.get(stringValue(row.customerId)) ?? null;
    const templateId = maps.templates.get(stringValue(row.templateId)) ?? null;
    const data = {
      balanceAmount: decimalValue(row.balanceAmount),
      customerId,
      discountTotal: decimalValue(row.discountTotal),
      dueDate: nullableDateValue(row.dueDate),
      finalizedAt: nullableDateValue(row.finalizedAt),
      grandTotal: decimalValue(row.grandTotal),
      invoiceDate: dateValue(row.invoiceDate),
      invoiceNumber,
      invoiceType: stringValue(row.invoiceType) || "standard",
      notes: nullableString(row.notes),
      paidAmount: decimalValue(row.paidAmount),
      status: stringValue(row.status) || "draft",
      subtotal: decimalValue(row.subtotal),
      taxTotal: decimalValue(row.taxTotal),
      templateId,
      terms: nullableString(row.terms),
    };
    const invoice = existing
      ? await tx.invoice.update({
          data,
          where: {
            id: existing.id,
          },
        })
      : await tx.invoice.create({
          data: {
            ...data,
            businessId,
            createdAt: dateValue(row.createdAt),
          },
        });

    maps.invoices.set(sourceId, invoice.id);
    counter[existing ? "updated" : "created"] += 1;

    for (const item of arrayValue(row.items)) {
      const itemName = stringValue(item.itemName);

      if (!itemName) {
        continue;
      }

      const sortOrder = numberValue(item.sortOrder);
      const productId = maps.products.get(stringValue(item.productId)) ?? null;
      const sourceItemId = oldId(item);
      const existingItem = await tx.invoiceItem.findFirst({
        where: {
          invoiceId: invoice.id,
          OR: [
            ...(sourceItemId ? [{ id: sourceItemId }] : []),
            {
              itemName,
              sortOrder,
            },
          ],
        },
      });
      const itemData = {
        description: nullableString(item.description),
        discount: decimalValue(item.discount),
        itemName,
        lineTotal: decimalValue(item.lineTotal),
        productId,
        quantity: decimalValue(item.quantity, "1"),
        sortOrder,
        taxAmount: decimalValue(item.taxAmount),
        taxRate: decimalValue(item.taxRate),
        unit: nullableString(item.unit),
        unitPrice: decimalValue(item.unitPrice),
      };
      const savedItem = existingItem
        ? await tx.invoiceItem.update({
            data: itemData,
            where: {
              id: existingItem.id,
            },
          })
        : await tx.invoiceItem.create({
            data: {
              ...itemData,
              invoiceId: invoice.id,
            },
          });

      maps.invoiceItems.set(sourceItemId, savedItem.id);
    }
  }
}

async function restorePayments(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: BackupRecord[],
  invoiceMap: Map<string, string>,
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const invoiceId = invoiceMap.get(stringValue(row.invoiceId));

    if (!invoiceId) {
      counter.skipped += 1;
      continue;
    }

    const amount = decimalValue(row.amount);
    const paymentDate = dateValue(row.paymentDate);
    const paymentMethod = stringValue(row.paymentMethod) || "cash";
    const existing = await tx.payment.findFirst({
      where: {
        amount,
        businessId,
        invoiceId,
        paymentDate,
        paymentMethod,
      },
    });

    if (existing) {
      counter.skipped += 1;
      continue;
    }

    await tx.payment.create({
      data: {
        amount,
        businessId,
        createdAt: dateValue(row.createdAt),
        invoiceId,
        notes: nullableString(row.notes),
        paymentDate,
        paymentMethod,
      },
    });
    counter.created += 1;
  }
}

async function reconcileInvoiceBalances(
  tx: Prisma.TransactionClient,
  invoiceIds: Iterable<string>,
) {
  for (const invoiceId of new Set(invoiceIds)) {
    const [invoice, payments] = await Promise.all([
      tx.invoice.findUnique({
        select: {
          grandTotal: true,
          paidAmount: true,
        },
        where: {
          id: invoiceId,
        },
      }),
      tx.payment.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          invoiceId,
        },
      }),
    ]);

    if (!invoice) {
      continue;
    }

    const recordedPayments = payments._sum.amount ?? new Prisma.Decimal(0);
    const paidAmount = invoice.paidAmount.gte(recordedPayments)
      ? invoice.paidAmount
      : recordedPayments;
    const calculatedBalance = invoice.grandTotal.minus(paidAmount);
    const balanceAmount = calculatedBalance.gt(0)
      ? calculatedBalance
      : new Prisma.Decimal(0);

    await tx.invoice.update({
      data: {
        balanceAmount,
        paidAmount,
      },
      where: {
        id: invoiceId,
      },
    });
  }
}

async function restoreExpenses(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: BackupRecord[],
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const category = stringValue(row.category);

    if (!category) {
      counter.skipped += 1;
      continue;
    }

    const amount = decimalValue(row.amount);
    const date = dateValue(row.date);
    const vendor = nullableString(row.vendor);
    const existing = await tx.expense.findFirst({
      where: {
        amount,
        businessId,
        category,
        date,
        vendor,
      },
    });

    if (existing) {
      await tx.expense.update({
        data: {
          attachmentPath: nullableString(row.attachmentPath),
          notes: nullableString(row.notes),
          paymentMethod: nullableString(row.paymentMethod),
          status: stringValue(row.status) || "active",
        },
        where: {
          id: existing.id,
        },
      });
      counter.updated += 1;
      continue;
    }

    await tx.expense.create({
      data: {
        amount,
        attachmentPath: nullableString(row.attachmentPath),
        businessId,
        category,
        createdAt: dateValue(row.createdAt),
        date,
        notes: nullableString(row.notes),
        paymentMethod: nullableString(row.paymentMethod),
        status: stringValue(row.status) || "active",
        vendor,
      },
    });
    counter.created += 1;
  }
}

async function restoreRefunds(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: Array<BackupRecord & { items?: BackupRecord[] }>,
  maps: {
    customers: Map<string, string>;
    invoiceItems: Map<string, string>;
    invoices: Map<string, string>;
    products: Map<string, string>;
    refunds: Map<string, string>;
  },
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const refundNumber = stringValue(row.refundNumber);
    const invoiceId = maps.invoices.get(stringValue(row.invoiceId));

    if (!refundNumber || !invoiceId) {
      counter.skipped += 1;
      continue;
    }

    const customerId = maps.customers.get(stringValue(row.customerId)) ?? null;
    const existing = await tx.refund.findFirst({
      where: {
        businessId,
        refundNumber,
      },
    });
    const data = {
      amount: decimalValue(row.amount),
      customerId,
      invoiceId,
      notes: nullableString(row.notes),
      reason: nullableString(row.reason),
      refundDate: dateValue(row.refundDate),
      refundMethod: stringValue(row.refundMethod) || "cash",
      refundNumber,
      status: stringValue(row.status) || "completed",
    };
    const refund = existing
      ? await tx.refund.update({
          data,
          where: {
            id: existing.id,
          },
        })
      : await tx.refund.create({
          data: {
            ...data,
            businessId,
            createdAt: dateValue(row.createdAt),
          },
        });

    maps.refunds.set(oldId(row), refund.id);
    counter[existing ? "updated" : "created"] += 1;

    for (const item of arrayValue(row.items)) {
      const invoiceItemId = maps.invoiceItems.get(stringValue(item.invoiceItemId));

      if (!invoiceItemId || !stringValue(item.itemName)) {
        continue;
      }

      const existingItem = await tx.refundItem.findFirst({
        where: {
          invoiceItemId,
          refundId: refund.id,
        },
      });
      const productId = maps.products.get(stringValue(item.productId)) ?? null;
      const itemData = {
        itemName: stringValue(item.itemName),
        productId,
        quantity: decimalValue(item.quantity),
        refundAmount: decimalValue(item.refundAmount),
        restockQuantity: decimalValue(item.restockQuantity),
        unitPrice: decimalValue(item.unitPrice),
      };

      if (existingItem) {
        await tx.refundItem.update({
          data: itemData,
          where: {
            id: existingItem.id,
          },
        });
      } else {
        await tx.refundItem.create({
          data: {
            ...itemData,
            createdAt: dateValue(item.createdAt),
            invoiceItemId,
            refundId: refund.id,
          },
        });
      }
    }
  }
}

async function restoreInventoryMovements(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: BackupRecord[],
  maps: {
    invoices: Map<string, string>;
    products: Map<string, string>;
  },
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const productId = maps.products.get(stringValue(row.productId));

    if (!productId) {
      counter.skipped += 1;
      continue;
    }

    const createdAt = dateValue(row.createdAt);
    const type = stringValue(row.type) || "adjustment";
    const quantity = decimalValue(row.quantity);
    const existing = await tx.inventoryMovement.findFirst({
      where: {
        businessId,
        createdAt,
        productId,
        quantity,
        type,
      },
    });

    if (existing) {
      counter.skipped += 1;
      continue;
    }

    await tx.inventoryMovement.create({
      data: {
        businessId,
        createdAt,
        invoiceId: maps.invoices.get(stringValue(row.invoiceId)) ?? null,
        notes: nullableString(row.notes),
        productId,
        quantity,
        type,
        unitCost: decimalValue(row.unitCost),
      },
    });
    counter.created += 1;
  }
}

async function restoreCommunicationNotes(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: BackupRecord[],
  maps: {
    customers: Map<string, string>;
    invoices: Map<string, string>;
  },
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const body = stringValue(row.body);

    if (!body) {
      counter.skipped += 1;
      continue;
    }

    const createdAt = dateValue(row.createdAt);
    const customerId = maps.customers.get(stringValue(row.customerId)) ?? null;
    const invoiceId = maps.invoices.get(stringValue(row.invoiceId)) ?? null;
    const existing = await tx.communicationNote.findFirst({
      where: {
        body,
        businessId,
        createdAt,
        customerId,
        invoiceId,
      },
    });

    if (existing) {
      counter.skipped += 1;
      continue;
    }

    await tx.communicationNote.create({
      data: {
        body,
        businessId,
        createdAt,
        customerId,
        followUpAt: nullableDateValue(row.followUpAt),
        invoiceId,
        type: stringValue(row.type) || "note",
      },
    });
    counter.created += 1;
  }
}

async function restoreInvoiceEmails(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: BackupRecord[],
  invoiceMap: Map<string, string>,
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const invoiceId = invoiceMap.get(stringValue(row.invoiceId));
    const recipientEmail = stringValue(row.recipientEmail);
    const subject = stringValue(row.subject);

    if (!invoiceId || !recipientEmail || !subject) {
      counter.skipped += 1;
      continue;
    }

    const sourceId = oldId(row);
    const preparedAt = dateValue(row.preparedAt);
    const existing = await tx.invoiceEmail.findFirst({
      where: {
        businessId,
        invoiceId,
        OR: [
          ...(sourceId ? [{ id: sourceId }] : []),
          {
            preparedAt,
            recipientEmail,
            subject,
          },
        ],
      },
    });
    const data = {
      body: stringValue(row.body),
      ccEmail: nullableString(row.ccEmail),
      errorMessage: nullableString(row.errorMessage),
      preparedAt,
      providerMessageId: nullableString(row.providerMessageId),
      recipientEmail,
      sentAt: nullableDateValue(row.sentAt),
      status: stringValue(row.status) || "prepared",
      subject,
    };

    if (existing) {
      await tx.invoiceEmail.update({
        data,
        where: {
          id: existing.id,
        },
      });
      counter.updated += 1;
      continue;
    }

    await tx.invoiceEmail.create({
      data: {
        ...data,
        businessId,
        createdAt: dateValue(row.createdAt),
        invoiceId,
      },
    });
    counter.created += 1;
  }
}

async function restoreImportJobs(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: Array<BackupRecord & { errors?: BackupRecord[] }>,
  idMap: Map<string, string>,
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const fileName = stringValue(row.fileName);
    const importType = stringValue(row.importType);

    if (!fileName || !importType) {
      counter.skipped += 1;
      continue;
    }

    const sourceId = oldId(row);
    const createdAt = dateValue(row.createdAt);
    const existing = await tx.importJob.findFirst({
      where: {
        businessId,
        OR: [
          ...(sourceId ? [{ id: sourceId }] : []),
          {
            createdAt,
            fileName,
            importType,
          },
        ],
      },
    });
    const data = {
      errorMessage: nullableString(row.errorMessage),
      failedRows: numberValue(row.failedRows),
      fileName,
      fileType: stringValue(row.fileType) || "application/octet-stream",
      importType,
      status: stringValue(row.status) || "uploaded",
      successfulRows: numberValue(row.successfulRows),
      totalRows: numberValue(row.totalRows),
    };
    const job = existing
      ? await tx.importJob.update({
          data,
          where: {
            id: existing.id,
          },
        })
      : await tx.importJob.create({
          data: {
            ...data,
            businessId,
            createdAt,
          },
        });

    idMap.set(sourceId, job.id);
    counter[existing ? "updated" : "created"] += 1;

    for (const error of arrayValue(row.errors)) {
      const errorType = stringValue(error.errorType);
      const message = stringValue(error.message);

      if (!errorType || !message) {
        continue;
      }

      const sourceErrorId = oldId(error);
      const errorCreatedAt = dateValue(error.createdAt);
      const existingError = await tx.importError.findFirst({
        where: {
          importJobId: job.id,
          OR: [
            ...(sourceErrorId ? [{ id: sourceErrorId }] : []),
            {
              createdAt: errorCreatedAt,
              errorType,
              message,
              rowNumber:
                error.rowNumber === null || error.rowNumber === undefined
                  ? null
                  : numberValue(error.rowNumber),
            },
          ],
        },
      });
      const errorData = {
        errorType,
        fieldName: nullableString(error.fieldName),
        message,
        originalValue: nullableString(error.originalValue),
        rowNumber:
          error.rowNumber === null || error.rowNumber === undefined
            ? null
            : numberValue(error.rowNumber),
      };

      if (existingError) {
        await tx.importError.update({
          data: errorData,
          where: {
            id: existingError.id,
          },
        });
      } else {
        await tx.importError.create({
          data: {
            ...errorData,
            createdAt: errorCreatedAt,
            importJobId: job.id,
          },
        });
      }
    }
  }
}

async function restoreImportedDocuments(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: Array<BackupRecord & { fields?: BackupRecord[] }>,
  importJobMap: Map<string, string>,
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const importJobId = importJobMap.get(stringValue(row.importJobId));
    const originalFileName = stringValue(row.originalFileName);

    if (!importJobId || !originalFileName) {
      counter.skipped += 1;
      continue;
    }

    const sourceId = oldId(row);
    const createdAt = dateValue(row.createdAt);
    const existing = await tx.importedDocument.findFirst({
      where: {
        businessId,
        importJobId,
        OR: [
          ...(sourceId ? [{ id: sourceId }] : []),
          {
            createdAt,
            originalFileName,
          },
        ],
      },
    });
    const data = {
      confidenceScore: decimalValue(row.confidenceScore),
      documentType: stringValue(row.documentType) || "other",
      extractedText: nullableString(row.extractedText),
      fileHash: nullableString(row.fileHash),
      filePath: stringValue(row.filePath),
      originalFileName,
      parsedJson: nullableString(row.parsedJson),
      status: stringValue(row.status) || "uploaded",
    };
    const document = existing
      ? await tx.importedDocument.update({
          data,
          where: {
            id: existing.id,
          },
        })
      : await tx.importedDocument.create({
          data: {
            ...data,
            businessId,
            createdAt,
            importJobId,
          },
        });

    counter[existing ? "updated" : "created"] += 1;

    for (const field of arrayValue(row.fields)) {
      const fieldName = stringValue(field.fieldName);

      if (!fieldName) {
        continue;
      }

      const sourceFieldId = oldId(field);
      const fieldCreatedAt = dateValue(field.createdAt);
      const existingField = await tx.extractedField.findFirst({
        where: {
          documentId: document.id,
          OR: [
            ...(sourceFieldId ? [{ id: sourceFieldId }] : []),
            {
              createdAt: fieldCreatedAt,
              fieldName,
            },
          ],
        },
      });
      const fieldData = {
        confidence: decimalValue(field.confidence),
        correctedValue: nullableString(field.correctedValue),
        extractedValue: nullableString(field.extractedValue),
        fieldName,
        status: stringValue(field.status) || "extracted",
      };

      if (existingField) {
        await tx.extractedField.update({
          data: fieldData,
          where: {
            id: existingField.id,
          },
        });
      } else {
        await tx.extractedField.create({
          data: {
            ...fieldData,
            createdAt: fieldCreatedAt,
            documentId: document.id,
          },
        });
      }
    }
  }
}

async function restoreDocumentFieldMappings(
  tx: Prisma.TransactionClient,
  businessId: string,
  rows: BackupRecord[],
  counter: RestoreCounter,
) {
  for (const row of rows) {
    const mappedField = stringValue(row.mappedField);
    const sourceLabel = stringValue(row.sourceLabel);

    if (!mappedField || !sourceLabel) {
      counter.skipped += 1;
      continue;
    }

    const existing = await tx.documentFieldMapping.findUnique({
      where: {
        businessId_sourceLabel_mappedField: {
          businessId,
          mappedField,
          sourceLabel,
        },
      },
    });
    const data = {
      confidence: decimalValue(row.confidence),
      lastUsedAt: nullableDateValue(row.lastUsedAt),
      timesUsed: numberValue(row.timesUsed),
    };

    if (existing) {
      await tx.documentFieldMapping.update({
        data,
        where: {
          id: existing.id,
        },
      });
      counter.updated += 1;
      continue;
    }

    await tx.documentFieldMapping.create({
      data: {
        ...data,
        businessId,
        createdAt: dateValue(row.createdAt),
        mappedField,
        sourceLabel,
      },
    });
    counter.created += 1;
  }
}

export async function restoreBusinessBackupMerge(
  businessId: string,
  jsonText: string,
): Promise<BackupRestoreResult> {
  const backup = parseBackupJson(jsonText);
  const preview = previewBusinessBackup(jsonText);
  const restored = Object.fromEntries(
    restoreSections.map((section) => [section, emptyCounter()]),
  ) as Record<string, RestoreCounter>;
  const maps = {
    customers: new Map<string, string>(),
    importJobs: new Map<string, string>(),
    invoiceItems: new Map<string, string>(),
    invoices: new Map<string, string>(),
    products: new Map<string, string>(),
    refunds: new Map<string, string>(),
    templates: new Map<string, string>(),
  };

  await prisma.$transaction(
    async (tx) => {
      await mergeBusinessProfile(tx, businessId, backup.business);
      await mergeBusinessEmailSetting(
        tx,
        businessId,
        backup.businessEmailSetting,
      );
      await restoreCustomers(
        tx,
        businessId,
        arrayValue(backup.customers),
        maps.customers,
        restored.customers,
      );
      await restoreProducts(
        tx,
        businessId,
        arrayValue(backup.products),
        maps.products,
        restored.products,
      );
      await restoreTemplates(
        tx,
        businessId,
        arrayValue(backup.invoiceTemplates),
        maps.templates,
        restored.invoiceTemplates,
      );
      await restoreInvoices(
        tx,
        businessId,
        arrayValue(backup.invoices) as Array<
          BackupRecord & { items?: BackupRecord[] }
        >,
        maps,
        restored.invoices,
      );
      await restorePayments(
        tx,
        businessId,
        arrayValue(backup.payments),
        maps.invoices,
        restored.payments,
      );
      await reconcileInvoiceBalances(tx, maps.invoices.values());
      await restoreRefunds(
        tx,
        businessId,
        arrayValue(backup.refunds) as Array<
          BackupRecord & { items?: BackupRecord[] }
        >,
        maps,
        restored.refunds,
      );
      await restoreExpenses(
        tx,
        businessId,
        arrayValue(backup.expenses),
        restored.expenses,
      );
      await restoreInventoryMovements(
        tx,
        businessId,
        arrayValue(backup.inventoryMovements),
        maps,
        restored.inventoryMovements,
      );
      await restoreCommunicationNotes(
        tx,
        businessId,
        arrayValue(backup.communicationNotes),
        maps,
        restored.communicationNotes,
      );
      await restoreInvoiceEmails(
        tx,
        businessId,
        arrayValue(backup.invoiceEmails),
        maps.invoices,
        restored.invoiceEmails,
      );
      await restoreImportJobs(
        tx,
        businessId,
        arrayValue(backup.importJobs) as Array<
          BackupRecord & { errors?: BackupRecord[] }
        >,
        maps.importJobs,
        restored.importJobs,
      );
      await restoreImportedDocuments(
        tx,
        businessId,
        arrayValue(backup.importedDocuments) as Array<
          BackupRecord & { fields?: BackupRecord[] }
        >,
        maps.importJobs,
        restored.importedDocuments,
      );
      await restoreDocumentFieldMappings(
        tx,
        businessId,
        arrayValue(backup.documentFieldMappings),
        restored.documentFieldMappings,
      );
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    },
  );

  return {
    ...preview,
    restored,
  };
}
