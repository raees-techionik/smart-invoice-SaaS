import "server-only";

import * as XLSX from "xlsx";

import { prisma } from "@/app/_backend/lib/db/prisma";

type ExportRow = Record<string, Date | number | string | null>;

type ExportSheet = {
  columns: string[];
  name: string;
  rows: ExportRow[];
};

type InvoiceImportJobExport = {
  buffer: Buffer;
  filename: string;
  rowCount: number;
};

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function exportFilename(fileName: string) {
  const slug = fileName
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "invoice-import"}-pdf-to-excel-${dateStamp()}.xlsx`;
}

function valueForField(
  fields: Array<{
    correctedValue: string | null;
    extractedValue: string | null;
    fieldName: string;
  }>,
  fieldName: string,
) {
  const field = fields.find((currentField) => currentField.fieldName === fieldName);
  const value = field?.correctedValue ?? field?.extractedValue ?? "";

  return value.trim() || null;
}

function documentRowNumber(
  fields: Array<{
    correctedValue: string | null;
    extractedValue: string | null;
    fieldName: string;
  }>,
  fallback: number,
) {
  const rowNumber = Number(valueForField(fields, "source_row_number"));

  return Number.isInteger(rowNumber) && rowNumber > 0 ? rowNumber : fallback;
}

function numberValue(value: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.replace(/[^\d.-]/g, "");
  const parsedValue = Number(normalizedValue);

  return normalizedValue && Number.isFinite(parsedValue) ? parsedValue : null;
}

function lineTotal(values: Record<string, string | null>) {
  const quantity = numberValue(values.quantity) ?? 0;
  const unitPrice = numberValue(values.unitPrice) ?? 0;
  const discount = numberValue(values.discount) ?? 0;
  const taxRate = numberValue(values.taxRate) ?? 0;
  const taxableAmount = Math.max(quantity * unitPrice - discount, 0);

  return taxableAmount + taxableAmount * (taxRate / 100);
}

function worksheetFromRows(sheet: ExportSheet) {
  const worksheet =
    sheet.rows.length > 0
      ? XLSX.utils.json_to_sheet(sheet.rows, {
          cellDates: true,
          header: sheet.columns,
        })
      : XLSX.utils.aoa_to_sheet([sheet.columns, ["No records found"]]);

  worksheet["!cols"] = sheet.columns.map((column) => ({
    wch: Math.min(Math.max(column.length + 2, 14), 34),
  }));

  return worksheet;
}

function workbookBuffer(sheets: ExportSheet[]) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(
      workbook,
      worksheetFromRows(sheet),
      sheet.name.slice(0, 31),
    );
  }

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
}

export async function buildInvoiceImportJobXlsx(
  businessId: string,
  importJobId: string,
): Promise<InvoiceImportJobExport | null> {
  const importJob = await prisma.importJob.findFirst({
    include: {
      documents: {
        include: {
          fields: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      errors: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    where: {
      businessId,
      id: importJobId,
      importType: "invoices",
    },
  });

  if (!importJob) {
    return null;
  }

  const invoiceRows = importJob.documents.map((document, index) => {
    const fields = document.fields;

    return {
      confidence_score: Number(document.confidenceScore),
      customer_email: valueForField(fields, "customerEmail"),
      customer_name: valueForField(fields, "customerName"),
      customer_phone: valueForField(fields, "customerPhone"),
      discount_total: numberValue(valueForField(fields, "discountTotal")),
      document_status: document.status,
      due_date: valueForField(fields, "dueDate"),
      grand_total: numberValue(valueForField(fields, "grandTotal")),
      invoice_date: valueForField(fields, "invoiceDate"),
      invoice_number: valueForField(fields, "invoiceNumber"),
      notes: valueForField(fields, "notes"),
      source_document: document.originalFileName,
      source_row_number: documentRowNumber(fields, index + 1),
      subtotal: numberValue(valueForField(fields, "subtotal")),
      tax_total: numberValue(valueForField(fields, "taxTotal")),
      terms: valueForField(fields, "terms"),
    };
  });

  const lineItemRows = importJob.documents.map((document, index) => {
    const fields = document.fields;
    const values = {
      discount: valueForField(fields, "discount"),
      productName: valueForField(fields, "productName"),
      productSku: valueForField(fields, "productSku"),
      quantity: valueForField(fields, "quantity"),
      taxRate: valueForField(fields, "taxRate"),
      unitPrice: valueForField(fields, "unitPrice"),
    };

    return {
      discount: numberValue(values.discount),
      invoice_number: valueForField(fields, "invoiceNumber"),
      item_description: valueForField(fields, "itemDescription"),
      line_total: lineTotal(values),
      product_name: values.productName,
      product_sku: values.productSku,
      quantity: numberValue(values.quantity),
      source_document: document.originalFileName,
      source_row_number: documentRowNumber(fields, index + 1),
      tax_rate: numberValue(values.taxRate),
      unit_price: numberValue(values.unitPrice),
    };
  });

  const customerRows = Array.from(
    invoiceRows
      .reduce((rows, row) => {
        const key =
          row.customer_email ||
          row.customer_phone ||
          row.customer_name ||
          row.source_document;

        if (!rows.has(key)) {
          rows.set(key, {
            customer_email: row.customer_email,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            invoice_count: 0,
            total_detected_amount: 0,
          });
        }

        const customer = rows.get(key);

        if (customer) {
          customer.invoice_count += 1;
          customer.total_detected_amount += row.grand_total ?? 0;
        }

        return rows;
      }, new Map<string, ExportRow & { invoice_count: number; total_detected_amount: number }>())
      .values(),
  );

  const productRows = Array.from(
    lineItemRows
      .reduce((rows, row) => {
        const key = row.product_sku || row.product_name || row.source_document;

        if (!rows.has(key)) {
          rows.set(key, {
            line_count: 0,
            product_name: row.product_name,
            product_sku: row.product_sku,
            total_detected_amount: 0,
            total_quantity: 0,
          });
        }

        const product = rows.get(key);

        if (product) {
          product.line_count += 1;
          product.total_detected_amount += row.line_total ?? 0;
          product.total_quantity += row.quantity ?? 0;
        }

        return rows;
      }, new Map<string, ExportRow & { line_count: number; total_detected_amount: number; total_quantity: number }>())
      .values(),
  );

  const errorRows = importJob.errors.map((error) => ({
    error_type: error.errorType,
    field_name: error.fieldName,
    message: error.message,
    original_value: error.originalValue,
    row_number: error.rowNumber,
  }));

  const sheets: ExportSheet[] = [
    {
      columns: [
        "invoice_number",
        "invoice_date",
        "due_date",
        "customer_name",
        "customer_email",
        "customer_phone",
        "subtotal",
        "discount_total",
        "tax_total",
        "grand_total",
        "document_status",
        "confidence_score",
        "source_document",
        "source_row_number",
        "notes",
        "terms",
      ],
      name: "Invoice Summary",
      rows: invoiceRows,
    },
    {
      columns: [
        "invoice_number",
        "product_name",
        "product_sku",
        "item_description",
        "quantity",
        "unit_price",
        "discount",
        "tax_rate",
        "line_total",
        "source_document",
        "source_row_number",
      ],
      name: "Invoice Line Items",
      rows: lineItemRows,
    },
    {
      columns: [
        "customer_name",
        "customer_email",
        "customer_phone",
        "invoice_count",
        "total_detected_amount",
      ],
      name: "Customers",
      rows: customerRows,
    },
    {
      columns: [
        "product_name",
        "product_sku",
        "line_count",
        "total_quantity",
        "total_detected_amount",
      ],
      name: "Products",
      rows: productRows,
    },
    {
      columns: [
        "row_number",
        "field_name",
        "error_type",
        "original_value",
        "message",
      ],
      name: "Extraction Errors",
      rows: errorRows,
    },
  ];

  return {
    buffer: workbookBuffer(sheets),
    filename: exportFilename(importJob.fileName),
    rowCount: sheets.reduce((total, sheet) => total + sheet.rows.length, 0),
  };
}
