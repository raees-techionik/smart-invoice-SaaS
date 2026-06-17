import "server-only";

import { prisma } from "@/app/_backend/lib/db/prisma";
import * as XLSX from "xlsx";

export const csvExportDatasets = [
  "customers",
  "products",
  "invoices",
  "payments",
  "expenses",
  "inventory-movements",
  "refunds",
  "refund-items",
] as const;

export type CsvExportDataset = (typeof csvExportDatasets)[number];

export type ExportSummary = {
  description: string;
  href: string;
  label: string;
  rows: number;
};

type CsvValue = boolean | Date | number | string | null | undefined;

type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => CsvValue;
};

type CsvExport = {
  csv: string;
  filename: string;
  label: string;
  rowCount: number;
};

type WorkbookExport = {
  buffer: Buffer;
  filename: string;
  label: string;
  rowCount: number;
};

type ExportObject = Record<string, boolean | Date | number | string | null | undefined>;

const datasetLabels: Record<CsvExportDataset, string> = {
  customers: "Customers",
  expenses: "Expenses",
  invoices: "Invoices",
  "inventory-movements": "Inventory movements",
  payments: "Payments",
  products: "Products",
  refunds: "Refunds",
  "refund-items": "Refund items",
};

const datasetDescriptions: Record<CsvExportDataset, string> = {
  customers: "Customer profiles, balances, contact details, and status.",
  expenses: "Operating costs, categories, receipts, payment methods, and status.",
  invoices: "Invoice headers, totals, customer links, template links, and status.",
  "inventory-movements":
    "Stock movement history including invoice deductions, refund returns, and adjustments.",
  payments: "Collections recorded against finalized invoices.",
  products: "Product/service catalog, pricing, tax, stock, and archive status.",
  refunds: "Header-level return/refund records linked to invoices and customers.",
  "refund-items": "Line-level refunded quantities, amounts, and restock details.",
};

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function csvValue(value: CsvValue) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function csvEscape(value: CsvValue) {
  const text = csvValue(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function csvFromRows<Row>(columns: CsvColumn<Row>[], rows: Row[]) {
  const headerRow = columns.map((column) => csvEscape(column.header)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((column) => csvEscape(column.value(row))).join(","),
  );

  return [headerRow, ...dataRows].join("\r\n");
}

function exportFilename(dataset: string, businessName: string, extension: string) {
  const slug = businessName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "business"}-${dataset}-${dateStamp()}.${extension}`;
}

export function isCsvExportDataset(value: string): value is CsvExportDataset {
  return csvExportDatasets.includes(value as CsvExportDataset);
}

export function csvExportLabel(dataset: CsvExportDataset) {
  return datasetLabels[dataset];
}

function exportObjectsToWorksheet(rows: ExportObject[]) {
  if (rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([["No records found"]]);
  }

  return XLSX.utils.json_to_sheet(rows, {
    cellDates: true,
  });
}

function workbookBuffer(
  sheets: Array<{
    name: string;
    rows: ExportObject[];
  }>,
) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(
      workbook,
      exportObjectsToWorksheet(sheet.rows),
      sheet.name.slice(0, 31),
    );
  }

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
}

export async function getExportSummaries(
  businessId: string,
): Promise<ExportSummary[]> {
  const [
    customers,
    products,
    invoices,
    payments,
    expenses,
    inventoryMovements,
    refunds,
    refundItems,
  ] = await Promise.all([
    prisma.customer.count({
      where: {
        businessId,
      },
    }),
    prisma.product.count({
      where: {
        businessId,
      },
    }),
    prisma.invoice.count({
      where: {
        businessId,
      },
    }),
    prisma.payment.count({
      where: {
        businessId,
      },
    }),
    prisma.expense.count({
      where: {
        businessId,
      },
    }),
    prisma.inventoryMovement.count({
      where: {
        businessId,
      },
    }),
    prisma.refund.count({
      where: {
        businessId,
      },
    }),
    prisma.refundItem.count({
      where: {
        refund: {
          businessId,
        },
      },
    }),
  ]);

  const rowsByDataset: Record<CsvExportDataset, number> = {
    customers,
    expenses,
    invoices,
    "inventory-movements": inventoryMovements,
    payments,
    products,
    refunds,
    "refund-items": refundItems,
  };

  return csvExportDatasets.map((dataset) => ({
    description: datasetDescriptions[dataset],
    href: `/dashboard/exports/${dataset}`,
    label: datasetLabels[dataset],
    rows: rowsByDataset[dataset],
  }));
}

export async function buildCsvExport(
  dataset: CsvExportDataset,
  businessId: string,
): Promise<CsvExport> {
  const business = await prisma.business.findUniqueOrThrow({
    select: {
      name: true,
    },
    where: {
      id: businessId,
    },
  });

  if (dataset === "customers") {
    const rows = await prisma.customer.findMany({
      orderBy: {
        name: "asc",
      },
      where: {
        businessId,
      },
    });

    return {
      csv: csvFromRows(
        [
          { header: "id", value: (row) => row.id },
          { header: "name", value: (row) => row.name },
          { header: "business_name", value: (row) => row.businessName },
          { header: "phone", value: (row) => row.phone },
          { header: "email", value: (row) => row.email },
          { header: "address", value: (row) => row.address },
          { header: "tax_number", value: (row) => row.taxNumber },
          { header: "opening_balance", value: (row) => row.openingBalance.toString() },
          { header: "status", value: (row) => row.status },
          { header: "notes", value: (row) => row.notes },
          { header: "created_at", value: (row) => row.createdAt },
          { header: "updated_at", value: (row) => row.updatedAt },
        ],
        rows,
      ),
      filename: exportFilename(dataset, business.name, "csv"),
      label: datasetLabels[dataset],
      rowCount: rows.length,
    };
  }

  if (dataset === "products") {
    const rows = await prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
      where: {
        businessId,
      },
    });

    return {
      csv: csvFromRows(
        [
          { header: "id", value: (row) => row.id },
          { header: "name", value: (row) => row.name },
          { header: "sku", value: (row) => row.sku },
          { header: "category", value: (row) => row.category },
          { header: "type", value: (row) => row.type },
          { header: "sale_price", value: (row) => row.salePrice.toString() },
          { header: "cost_price", value: (row) => row.costPrice.toString() },
          { header: "tax_rate", value: (row) => row.taxRate.toString() },
          { header: "unit", value: (row) => row.unit },
          { header: "stock_quantity", value: (row) => row.stockQuantity.toString() },
          { header: "low_stock_alert", value: (row) => row.lowStockAlert.toString() },
          { header: "status", value: (row) => row.status },
          { header: "description", value: (row) => row.description },
          { header: "created_at", value: (row) => row.createdAt },
          { header: "updated_at", value: (row) => row.updatedAt },
        ],
        rows,
      ),
      filename: exportFilename(dataset, business.name, "csv"),
      label: datasetLabels[dataset],
      rowCount: rows.length,
    };
  }

  if (dataset === "invoices") {
    const rows = await prisma.invoice.findMany({
      include: {
        _count: {
          select: {
            items: true,
            payments: true,
          },
        },
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
        customer: {
          select: {
            businessName: true,
            name: true,
          },
        },
        template: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        invoiceDate: "desc",
      },
      where: {
        businessId,
      },
    });

    return {
      csv: csvFromRows(
        [
          { header: "id", value: (row) => row.id },
          { header: "invoice_number", value: (row) => row.invoiceNumber },
          { header: "invoice_type", value: (row) => row.invoiceType },
          { header: "status", value: (row) => row.status },
          { header: "customer_name", value: (row) => row.customer?.name },
          {
            header: "customer_business_name",
            value: (row) => row.customer?.businessName,
          },
          { header: "template_name", value: (row) => row.template?.name },
          { header: "created_by", value: (row) => row.createdBy?.name },
          { header: "created_by_email", value: (row) => row.createdBy?.email },
          { header: "invoice_date", value: (row) => row.invoiceDate },
          { header: "due_date", value: (row) => row.dueDate },
          { header: "subtotal", value: (row) => row.subtotal.toString() },
          {
            header: "discount_total",
            value: (row) => row.discountTotal.toString(),
          },
          { header: "tax_total", value: (row) => row.taxTotal.toString() },
          { header: "grand_total", value: (row) => row.grandTotal.toString() },
          { header: "paid_amount", value: (row) => row.paidAmount.toString() },
          {
            header: "balance_amount",
            value: (row) => row.balanceAmount.toString(),
          },
          { header: "item_count", value: (row) => row._count.items },
          { header: "payment_count", value: (row) => row._count.payments },
          { header: "notes", value: (row) => row.notes },
          { header: "terms", value: (row) => row.terms },
          { header: "finalized_at", value: (row) => row.finalizedAt },
          { header: "created_at", value: (row) => row.createdAt },
          { header: "updated_at", value: (row) => row.updatedAt },
        ],
        rows,
      ),
      filename: exportFilename(dataset, business.name, "csv"),
      label: datasetLabels[dataset],
      rowCount: rows.length,
    };
  }

  if (dataset === "payments") {
    const rows = await prisma.payment.findMany({
      include: {
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
        invoice: {
          include: {
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        paymentDate: "desc",
      },
      where: {
        businessId,
      },
    });

    return {
      csv: csvFromRows(
        [
          { header: "id", value: (row) => row.id },
          { header: "invoice_number", value: (row) => row.invoice.invoiceNumber },
          { header: "customer_name", value: (row) => row.invoice.customer?.name },
          { header: "amount", value: (row) => row.amount.toString() },
          { header: "payment_date", value: (row) => row.paymentDate },
          { header: "payment_method", value: (row) => row.paymentMethod },
          { header: "notes", value: (row) => row.notes },
          { header: "created_by", value: (row) => row.createdBy?.name },
          { header: "created_by_email", value: (row) => row.createdBy?.email },
          { header: "created_at", value: (row) => row.createdAt },
          { header: "updated_at", value: (row) => row.updatedAt },
        ],
        rows,
      ),
      filename: exportFilename(dataset, business.name, "csv"),
      label: datasetLabels[dataset],
      rowCount: rows.length,
    };
  }

  if (dataset === "expenses") {
    const rows = await prisma.expense.findMany({
      include: {
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      where: {
        businessId,
      },
    });

    return {
      csv: csvFromRows(
        [
          { header: "id", value: (row) => row.id },
          { header: "date", value: (row) => row.date },
          { header: "category", value: (row) => row.category },
          { header: "amount", value: (row) => row.amount.toString() },
          { header: "payment_method", value: (row) => row.paymentMethod },
          { header: "vendor", value: (row) => row.vendor },
          { header: "notes", value: (row) => row.notes },
          { header: "receipt_attached", value: (row) => Boolean(row.attachmentPath) },
          { header: "attachment_path", value: (row) => row.attachmentPath },
          { header: "status", value: (row) => row.status },
          { header: "created_by", value: (row) => row.createdBy?.name },
          { header: "created_by_email", value: (row) => row.createdBy?.email },
          { header: "created_at", value: (row) => row.createdAt },
          { header: "updated_at", value: (row) => row.updatedAt },
        ],
        rows,
      ),
      filename: exportFilename(dataset, business.name, "csv"),
      label: datasetLabels[dataset],
      rowCount: rows.length,
    };
  }

  if (dataset === "refunds") {
    const rows = await prisma.refund.findMany({
      include: {
        _count: {
          select: {
            items: true,
          },
        },
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
        customer: {
          select: {
            businessName: true,
            email: true,
            name: true,
            phone: true,
          },
        },
        invoice: {
          select: {
            invoiceNumber: true,
            status: true,
          },
        },
      },
      orderBy: {
        refundDate: "desc",
      },
      where: {
        businessId,
      },
    });

    return {
      csv: csvFromRows(
        [
          { header: "id", value: (row) => row.id },
          { header: "refund_number", value: (row) => row.refundNumber },
          { header: "invoice_number", value: (row) => row.invoice.invoiceNumber },
          { header: "invoice_status", value: (row) => row.invoice.status },
          { header: "customer_name", value: (row) => row.customer?.name },
          {
            header: "customer_business_name",
            value: (row) => row.customer?.businessName,
          },
          { header: "customer_phone", value: (row) => row.customer?.phone },
          { header: "customer_email", value: (row) => row.customer?.email },
          { header: "amount", value: (row) => row.amount.toString() },
          { header: "refund_date", value: (row) => row.refundDate },
          { header: "refund_method", value: (row) => row.refundMethod },
          { header: "reason", value: (row) => row.reason },
          { header: "notes", value: (row) => row.notes },
          { header: "status", value: (row) => row.status },
          { header: "item_count", value: (row) => row._count.items },
          { header: "created_by", value: (row) => row.createdBy?.name },
          { header: "created_by_email", value: (row) => row.createdBy?.email },
          { header: "created_at", value: (row) => row.createdAt },
          { header: "updated_at", value: (row) => row.updatedAt },
        ],
        rows,
      ),
      filename: exportFilename(dataset, business.name, "csv"),
      label: datasetLabels[dataset],
      rowCount: rows.length,
    };
  }

  if (dataset === "refund-items") {
    const rows = await prisma.refundItem.findMany({
      include: {
        invoiceItem: {
          select: {
            unit: true,
          },
        },
        product: {
          select: {
            name: true,
            sku: true,
            unit: true,
          },
        },
        refund: {
          include: {
            customer: {
              select: {
                name: true,
              },
            },
            invoice: {
              select: {
                invoiceNumber: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        refund: {
          businessId,
        },
      },
    });

    return {
      csv: csvFromRows(
        [
          { header: "id", value: (row) => row.id },
          { header: "refund_id", value: (row) => row.refundId },
          { header: "refund_number", value: (row) => row.refund.refundNumber },
          { header: "invoice_number", value: (row) => row.refund.invoice.invoiceNumber },
          { header: "customer_name", value: (row) => row.refund.customer?.name },
          { header: "item_name", value: (row) => row.itemName },
          { header: "product_name", value: (row) => row.product?.name },
          { header: "product_sku", value: (row) => row.product?.sku },
          {
            header: "product_unit",
            value: (row) => row.product?.unit ?? row.invoiceItem.unit,
          },
          { header: "quantity", value: (row) => row.quantity.toString() },
          { header: "unit_price", value: (row) => row.unitPrice.toString() },
          { header: "refund_amount", value: (row) => row.refundAmount.toString() },
          {
            header: "restock_quantity",
            value: (row) => row.restockQuantity.toString(),
          },
          { header: "created_at", value: (row) => row.createdAt },
        ],
        rows,
      ),
      filename: exportFilename(dataset, business.name, "csv"),
      label: datasetLabels[dataset],
      rowCount: rows.length,
    };
  }

  const rows = await prisma.inventoryMovement.findMany({
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
        },
      },
      product: {
        select: {
          name: true,
          sku: true,
          unit: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: {
      businessId,
    },
  });

  return {
    csv: csvFromRows(
      [
        { header: "id", value: (row) => row.id },
        { header: "product_name", value: (row) => row.product.name },
        { header: "product_sku", value: (row) => row.product.sku },
        { header: "product_unit", value: (row) => row.product.unit },
        { header: "invoice_number", value: (row) => row.invoice?.invoiceNumber },
        { header: "type", value: (row) => row.type },
        { header: "quantity", value: (row) => row.quantity.toString() },
        { header: "unit_cost", value: (row) => row.unitCost.toString() },
        { header: "notes", value: (row) => row.notes },
        { header: "created_at", value: (row) => row.createdAt },
      ],
      rows,
    ),
    filename: exportFilename(dataset, business.name, "csv"),
    label: datasetLabels[dataset],
    rowCount: rows.length,
  };
}

export async function buildXlsxExport(
  dataset: CsvExportDataset,
  businessId: string,
): Promise<WorkbookExport> {
  const business = await prisma.business.findUniqueOrThrow({
    select: {
      name: true,
    },
    where: {
      id: businessId,
    },
  });
  const { label, rows } = await buildDatasetExportObjects(dataset, businessId);

  return {
    buffer: workbookBuffer([
      {
        name: label,
        rows,
      },
    ]),
    filename: exportFilename(dataset, business.name, "xlsx"),
    label,
    rowCount: rows.length,
  };
}

async function buildDatasetExportObjects(
  dataset: CsvExportDataset,
  businessId: string,
): Promise<{
  label: string;
  rows: ExportObject[];
}> {
  if (dataset === "customers") {
    const rows = await prisma.customer.findMany({
      orderBy: {
        name: "asc",
      },
      where: {
        businessId,
      },
    });

    return {
      label: datasetLabels[dataset],
      rows: rows.map((row) => ({
        address: row.address,
        business_name: row.businessName,
        created_at: row.createdAt,
        email: row.email,
        id: row.id,
        name: row.name,
        notes: row.notes,
        opening_balance: row.openingBalance.toString(),
        phone: row.phone,
        status: row.status,
        tax_number: row.taxNumber,
        updated_at: row.updatedAt,
      })),
    };
  }

  if (dataset === "products") {
    const rows = await prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
      where: {
        businessId,
      },
    });

    return {
      label: datasetLabels[dataset],
      rows: rows.map((row) => ({
        category: row.category,
        cost_price: row.costPrice.toString(),
        created_at: row.createdAt,
        description: row.description,
        id: row.id,
        low_stock_alert: row.lowStockAlert.toString(),
        name: row.name,
        sale_price: row.salePrice.toString(),
        sku: row.sku,
        status: row.status,
        stock_quantity: row.stockQuantity.toString(),
        tax_rate: row.taxRate.toString(),
        type: row.type,
        unit: row.unit,
        updated_at: row.updatedAt,
      })),
    };
  }

  if (dataset === "invoices") {
    const rows = await prisma.invoice.findMany({
      include: {
        _count: {
          select: {
            items: true,
            payments: true,
          },
        },
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
        customer: {
          select: {
            businessName: true,
            name: true,
          },
        },
        template: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        invoiceDate: "desc",
      },
      where: {
        businessId,
      },
    });

    return {
      label: datasetLabels[dataset],
      rows: rows.map((row) => ({
        balance_amount: row.balanceAmount.toString(),
        created_at: row.createdAt,
        created_by: row.createdBy?.name,
        created_by_email: row.createdBy?.email,
        customer_business_name: row.customer?.businessName,
        customer_name: row.customer?.name,
        discount_total: row.discountTotal.toString(),
        due_date: row.dueDate,
        finalized_at: row.finalizedAt,
        grand_total: row.grandTotal.toString(),
        id: row.id,
        invoice_date: row.invoiceDate,
        invoice_number: row.invoiceNumber,
        invoice_type: row.invoiceType,
        item_count: row._count.items,
        notes: row.notes,
        paid_amount: row.paidAmount.toString(),
        payment_count: row._count.payments,
        status: row.status,
        subtotal: row.subtotal.toString(),
        tax_total: row.taxTotal.toString(),
        template_name: row.template?.name,
        terms: row.terms,
        updated_at: row.updatedAt,
      })),
    };
  }

  if (dataset === "payments") {
    const rows = await prisma.payment.findMany({
      include: {
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
        invoice: {
          include: {
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        paymentDate: "desc",
      },
      where: {
        businessId,
      },
    });

    return {
      label: datasetLabels[dataset],
      rows: rows.map((row) => ({
        amount: row.amount.toString(),
        created_at: row.createdAt,
        created_by: row.createdBy?.name,
        created_by_email: row.createdBy?.email,
        customer_name: row.invoice.customer?.name,
        id: row.id,
        invoice_number: row.invoice.invoiceNumber,
        notes: row.notes,
        payment_date: row.paymentDate,
        payment_method: row.paymentMethod,
        updated_at: row.updatedAt,
      })),
    };
  }

  if (dataset === "expenses") {
    const rows = await prisma.expense.findMany({
      include: {
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      where: {
        businessId,
      },
    });

    return {
      label: datasetLabels[dataset],
      rows: rows.map((row) => ({
        amount: row.amount.toString(),
        attachment_path: row.attachmentPath,
        category: row.category,
        created_at: row.createdAt,
        created_by: row.createdBy?.name,
        created_by_email: row.createdBy?.email,
        date: row.date,
        id: row.id,
        notes: row.notes,
        payment_method: row.paymentMethod,
        receipt_attached: Boolean(row.attachmentPath),
        status: row.status,
        updated_at: row.updatedAt,
        vendor: row.vendor,
      })),
    };
  }

  if (dataset === "refunds") {
    const rows = await prisma.refund.findMany({
      include: {
        _count: {
          select: {
            items: true,
          },
        },
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
        customer: {
          select: {
            businessName: true,
            email: true,
            name: true,
            phone: true,
          },
        },
        invoice: {
          select: {
            invoiceNumber: true,
            status: true,
          },
        },
      },
      orderBy: {
        refundDate: "desc",
      },
      where: {
        businessId,
      },
    });

    return {
      label: datasetLabels[dataset],
      rows: rows.map((row) => ({
        amount: row.amount.toString(),
        created_at: row.createdAt,
        created_by: row.createdBy?.name,
        created_by_email: row.createdBy?.email,
        customer_business_name: row.customer?.businessName,
        customer_email: row.customer?.email,
        customer_name: row.customer?.name,
        customer_phone: row.customer?.phone,
        id: row.id,
        invoice_number: row.invoice.invoiceNumber,
        invoice_status: row.invoice.status,
        item_count: row._count.items,
        notes: row.notes,
        reason: row.reason,
        refund_date: row.refundDate,
        refund_method: row.refundMethod,
        refund_number: row.refundNumber,
        status: row.status,
        updated_at: row.updatedAt,
      })),
    };
  }

  if (dataset === "refund-items") {
    const rows = await prisma.refundItem.findMany({
      include: {
        invoiceItem: {
          select: {
            unit: true,
          },
        },
        product: {
          select: {
            name: true,
            sku: true,
            unit: true,
          },
        },
        refund: {
          include: {
            customer: {
              select: {
                name: true,
              },
            },
            invoice: {
              select: {
                invoiceNumber: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        refund: {
          businessId,
        },
      },
    });

    return {
      label: datasetLabels[dataset],
      rows: rows.map((row) => ({
        created_at: row.createdAt,
        customer_name: row.refund.customer?.name,
        id: row.id,
        invoice_number: row.refund.invoice.invoiceNumber,
        item_name: row.itemName,
        product_name: row.product?.name,
        product_sku: row.product?.sku,
        product_unit: row.product?.unit ?? row.invoiceItem.unit,
        quantity: row.quantity.toString(),
        refund_amount: row.refundAmount.toString(),
        refund_id: row.refundId,
        refund_number: row.refund.refundNumber,
        restock_quantity: row.restockQuantity.toString(),
        unit_price: row.unitPrice.toString(),
      })),
    };
  }

  const rows = await prisma.inventoryMovement.findMany({
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
        },
      },
      product: {
        select: {
          name: true,
          sku: true,
          unit: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: {
      businessId,
    },
  });

  return {
    label: datasetLabels[dataset],
    rows: rows.map((row) => ({
      created_at: row.createdAt,
      id: row.id,
      invoice_number: row.invoice?.invoiceNumber,
      notes: row.notes,
      product_name: row.product.name,
      product_sku: row.product.sku,
      product_unit: row.product.unit,
      quantity: row.quantity.toString(),
      type: row.type,
      unit_cost: row.unitCost.toString(),
    })),
  };
}

export async function buildBusinessBackup(businessId: string) {
  const [
    business,
    businessEmailSetting,
    users,
    customers,
    products,
    invoiceTemplates,
    invoices,
    invoiceEmails,
    communicationNotes,
    payments,
    refunds,
    refundItems,
    expenses,
    inventoryMovements,
    importJobs,
    importedDocuments,
    documentFieldMappings,
    exportAuditLogs,
  ] = await Promise.all([
    prisma.business.findUniqueOrThrow({
      where: {
        id: businessId,
      },
    }),
    prisma.businessEmailSetting.findUnique({
      where: {
        businessId,
      },
    }),
    prisma.user.findMany({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        createdAt: true,
        email: true,
        id: true,
        name: true,
        role: true,
        status: true,
        updatedAt: true,
      },
      where: {
        businessId,
      },
    }),
    prisma.customer.findMany({
      orderBy: {
        name: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.invoiceTemplate.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.invoice.findMany({
      include: {
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.invoiceEmail.findMany({
      orderBy: {
        preparedAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.communicationNote.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.payment.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.refund.findMany({
      include: {
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.refundItem.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        refund: {
          businessId,
        },
      },
    }),
    prisma.expense.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.inventoryMovement.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.importJob.findMany({
      include: {
        errors: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.importedDocument.findMany({
      include: {
        fields: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.documentFieldMapping.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.exportAuditLog.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
  ]);

  return {
    backupVersion: 3,
    exportedAt: new Date().toISOString(),
    business,
    businessEmailSetting: businessEmailSetting
      ? {
          businessId: businessEmailSetting.businessId,
          createdAt: businessEmailSetting.createdAt,
          fromEmail: businessEmailSetting.fromEmail,
          fromName: businessEmailSetting.fromName,
          hasSmtpPassword: Boolean(businessEmailSetting.smtpPasswordEncrypted),
          id: businessEmailSetting.id,
          replyToEmail: businessEmailSetting.replyToEmail,
          smtpHost: businessEmailSetting.smtpHost,
          smtpPort: businessEmailSetting.smtpPort,
          smtpSecure: businessEmailSetting.smtpSecure,
          smtpUsername: businessEmailSetting.smtpUsername,
          updatedAt: businessEmailSetting.updatedAt,
        }
      : null,
    customers,
    communicationNotes,
    documentFieldMappings,
    expenses,
    exportAuditLogs,
    importedDocuments,
    importJobs,
    inventoryMovements,
    invoiceEmails,
    invoiceTemplates,
    invoices,
    payments,
    products,
    refundItems,
    refunds,
    users,
  };
}

export async function buildBusinessBackupExport(businessId: string) {
  const business = await prisma.business.findUniqueOrThrow({
    select: {
      name: true,
    },
    where: {
      id: businessId,
    },
  });
  const backup = await buildBusinessBackup(businessId);

  return {
    backup,
    filename: exportFilename("backup", business.name, "json"),
  };
}

export async function buildBusinessWorkbookExport(businessId: string) {
  const business = await prisma.business.findUniqueOrThrow({
    select: {
      name: true,
    },
    where: {
      id: businessId,
    },
  });
  const [
    customers,
    products,
    invoices,
    payments,
    refunds,
    refundItems,
    expenses,
    inventoryMovements,
    invoiceItems,
    invoiceTemplates,
    importJobs,
    importErrors,
    exportAuditLogs,
  ] = await Promise.all([
    buildDatasetExportObjects("customers", businessId),
    buildDatasetExportObjects("products", businessId),
    buildDatasetExportObjects("invoices", businessId),
    buildDatasetExportObjects("payments", businessId),
    buildDatasetExportObjects("refunds", businessId),
    buildDatasetExportObjects("refund-items", businessId),
    buildDatasetExportObjects("expenses", businessId),
    buildDatasetExportObjects("inventory-movements", businessId),
    prisma.invoiceItem.findMany({
      include: {
        invoice: {
          select: {
            businessId: true,
            invoiceNumber: true,
          },
        },
        product: {
          select: {
            name: true,
            sku: true,
          },
        },
      },
      orderBy: {
        sortOrder: "asc",
      },
      where: {
        invoice: {
          businessId,
        },
      },
    }),
    prisma.invoiceTemplate.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        businessId,
      },
    }),
    prisma.importJob.findMany({
      orderBy: {
        createdAt: "desc",
      },
      where: {
        businessId,
      },
    }),
    prisma.importError.findMany({
      include: {
        importJob: {
          select: {
            businessId: true,
            fileName: true,
            importType: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        importJob: {
          businessId,
        },
      },
    }),
    prisma.exportAuditLog.findMany({
      include: {
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        businessId,
      },
    }),
  ]);
  const invoiceItemRows = invoiceItems.map((row) => ({
    description: row.description,
    discount: row.discount.toString(),
    invoice_number: row.invoice.invoiceNumber,
    item_name: row.itemName,
    line_total: row.lineTotal.toString(),
    product_name: row.product?.name,
    product_sku: row.product?.sku,
    quantity: row.quantity.toString(),
    sort_order: row.sortOrder,
    tax_amount: row.taxAmount.toString(),
    tax_rate: row.taxRate.toString(),
    unit: row.unit,
    unit_price: row.unitPrice.toString(),
  }));
  const templateRows = invoiceTemplates.map((row) => ({
    created_at: row.createdAt,
    id: row.id,
    is_default: row.isDefault,
    name: row.name,
    settings: row.settings,
    updated_at: row.updatedAt,
  }));
  const importJobRows = importJobs.map((row) => ({
    created_at: row.createdAt,
    failed_rows: row.failedRows,
    file_name: row.fileName,
    file_type: row.fileType,
    id: row.id,
    import_type: row.importType,
    status: row.status,
    successful_rows: row.successfulRows,
    total_rows: row.totalRows,
    updated_at: row.updatedAt,
  }));
  const importErrorRows = importErrors.map((row) => ({
    created_at: row.createdAt,
    error_type: row.errorType,
    field_name: row.fieldName,
    file_name: row.importJob.fileName,
    import_type: row.importJob.importType,
    message: row.message,
    original_value: row.originalValue,
    row_number: row.rowNumber,
  }));
  const exportAuditRows = exportAuditLogs.map((row) => ({
    created_at: row.createdAt,
    created_by: row.createdBy?.name,
    created_by_email: row.createdBy?.email,
    export_type: row.exportType,
    filename: row.filename,
    filters_json: row.filtersJson,
    format: row.format,
    report_name: row.reportName,
    row_count: row.rowCount,
    status: row.status,
  }));
  const sheets = [
    { name: "Customers", rows: customers.rows },
    { name: "Products", rows: products.rows },
    { name: "Invoices", rows: invoices.rows },
    { name: "Invoice Items", rows: invoiceItemRows },
    { name: "Payments", rows: payments.rows },
    { name: "Refunds", rows: refunds.rows },
    { name: "Refund Items", rows: refundItems.rows },
    { name: "Expenses", rows: expenses.rows },
    { name: "Inventory Movements", rows: inventoryMovements.rows },
    { name: "Invoice Templates", rows: templateRows },
    { name: "Import Jobs", rows: importJobRows },
    { name: "Import Errors", rows: importErrorRows },
    { name: "Export Audit Logs", rows: exportAuditRows },
  ];

  return {
    buffer: workbookBuffer(sheets),
    filename: exportFilename("business-workbook", business.name, "xlsx"),
    rowCount: sheets.reduce((total, sheet) => total + sheet.rows.length, 0),
  };
}
