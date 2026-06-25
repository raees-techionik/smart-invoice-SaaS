import "server-only";

import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

import {
  inferSmartFieldsFromText,
  inferSmartInvoiceLineItemsFromText,
  type SmartExtractedField,
  type SmartInvoiceLine,
} from "@/app/_backend/lib/import-smart-logic";

export const importTypes = [
  "customers",
  "products",
  "invoices",
  "expenses",
  "payments",
  "inventory",
] as const;

export type ImportType = (typeof importTypes)[number];

export const documentTypes = [
  "csv",
  "spreadsheet",
  "invoice",
  "receipt",
  "business_card",
  "other",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export const mappedFieldsByImportType: Record<ImportType, string[]> = {
  customers: [
    "name",
    "businessName",
    "phone",
    "email",
    "address",
    "taxNumber",
    "openingBalance",
    "notes",
  ],
  invoices: [
    "invoiceNumber",
    "customerName",
    "customerEmail",
    "customerPhone",
    "invoiceDate",
    "dueDate",
    "productName",
    "productSku",
    "itemDescription",
    "quantity",
    "unitPrice",
    "discount",
    "taxRate",
    "subtotal",
    "discountTotal",
    "taxTotal",
    "grandTotal",
    "notes",
    "terms",
  ],
  products: [
    "name",
    "sku",
    "category",
    "type",
    "salePrice",
    "costPrice",
    "taxRate",
    "unit",
    "stockQuantity",
    "lowStockAlert",
    "description",
  ],
  expenses: [
    "date",
    "category",
    "amount",
    "paymentMethod",
    "vendor",
    "notes",
    "status",
  ],
  payments: [
    "invoiceNumber",
    "customerName",
    "amount",
    "paymentDate",
    "paymentMethod",
    "notes",
  ],
  inventory: [
    "productName",
    "productSku",
    "movementType",
    "quantity",
    "unitCost",
    "notes",
  ],
};

export type ExtractedFieldInput = {
  confidence: Prisma.Decimal;
  extractedValue: string | null;
  fieldName: string;
  status: string;
};

export type InitialExtractionInput = {
  documentType: DocumentType;
  extractionConfidence?: number;
  extractionSource?: string;
  extractionWarning?: string;
  fileBuffer?: Buffer;
  fileName: string;
  fileSize: number;
  fileType: string;
  importType: ImportType;
  textContent: string;
};

export type ImportedDocumentSeed = {
  confidenceScore: Prisma.Decimal;
  extractedText: string | null;
  fields: ExtractedFieldInput[];
  originalFileName: string;
  parsedJson: string;
};

export type ImportTemplateExport = {
  buffer: Buffer;
  filename: string;
};

export function isImportType(value: string): value is ImportType {
  return importTypes.includes(value as ImportType);
}

export function isDocumentType(value: string): value is DocumentType {
  return documentTypes.includes(value as DocumentType);
}

export function readableImportType(value: string) {
  return value.replace(/-/g, " ").replace(/_/g, " ");
}

function importTemplateFilename(importType: ImportType) {
  return `${importType}-import-template.xlsx`;
}

export function buildImportTemplateXlsx(
  importType: ImportType,
): ImportTemplateExport {
  const headers = mappedFieldsByImportType[importType];
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);

  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.min(Math.max(header.length + 4, 14), 28),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    readableImportType(importType).slice(0, 31),
  );

  return {
    buffer: XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    }) as Buffer,
    filename: importTemplateFilename(importType),
  };
}

function normalizeFieldName(value: string) {
  const normalized = value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();

  return normalized || "unmapped_field";
}

function compactFieldName(value: string) {
  return normalizeFieldName(value).replace(/_/g, "");
}

const columnAliases: Record<ImportType, Record<string, string>> = {
  customers: {
    balance: "openingBalance",
    buyer: "name",
    client: "name",
    clientname: "name",
    company: "businessName",
    companyname: "businessName",
    contact: "phone",
    contactno: "phone",
    contactnumber: "phone",
    customer: "name",
    customername: "name",
    gst: "taxNumber",
    mobile: "phone",
    mobileno: "phone",
    mobilenumber: "phone",
    ntn: "taxNumber",
    opening: "openingBalance",
    openingbalance: "openingBalance",
    remarks: "notes",
    tax: "taxNumber",
    taxno: "taxNumber",
    taxnumber: "taxNumber",
  },
  invoices: {
    amount: "grandTotal",
    billno: "invoiceNumber",
    billnumber: "invoiceNumber",
    buyer: "customerName",
    client: "customerName",
    customer: "customerName",
    customeremail: "customerEmail",
    customermobile: "customerPhone",
    customername: "customerName",
    customerphone: "customerPhone",
    date: "invoiceDate",
    description: "itemDescription",
    discountamount: "discountTotal",
    duedate: "dueDate",
    grandtotal: "grandTotal",
    invoice: "invoiceNumber",
    invoicedate: "invoiceDate",
    invoiceno: "invoiceNumber",
    invoicenumber: "invoiceNumber",
    item: "productName",
    itemcode: "productSku",
    itemdescription: "itemDescription",
    itemname: "productName",
    mobile: "customerPhone",
    phone: "customerPhone",
    price: "unitPrice",
    product: "productName",
    productcode: "productSku",
    productname: "productName",
    productsku: "productSku",
    qty: "quantity",
    rate: "unitPrice",
    receiptno: "invoiceNumber",
    receiptnumber: "invoiceNumber",
    sku: "productSku",
    tax: "taxRate",
    taxamount: "taxTotal",
    total: "grandTotal",
    unitprice: "unitPrice",
  },
  products: {
    alert: "lowStockAlert",
    code: "sku",
    cost: "costPrice",
    costprice: "costPrice",
    item: "name",
    itemcode: "sku",
    itemname: "name",
    lowstock: "lowStockAlert",
    lowstockalert: "lowStockAlert",
    minstock: "lowStockAlert",
    price: "salePrice",
    product: "name",
    productcode: "sku",
    productname: "name",
    purchaseprice: "costPrice",
    qty: "stockQuantity",
    quantity: "stockQuantity",
    rate: "salePrice",
    reorderlevel: "lowStockAlert",
    saleprice: "salePrice",
    salesprice: "salePrice",
    stock: "stockQuantity",
    stockqty: "stockQuantity",
    tax: "taxRate",
    uom: "unit",
    unitprice: "salePrice",
  },
  expenses: {
    amount: "amount",
    cost: "amount",
    date: "date",
    description: "notes",
    expense: "category",
    expenseamount: "amount",
    expensecategory: "category",
    expensedate: "date",
    grandtotal: "amount",
    merchant: "vendor",
    method: "paymentMethod",
    mode: "paymentMethod",
    paidby: "paymentMethod",
    paidon: "date",
    paidto: "vendor",
    payment: "paymentMethod",
    paymentdate: "date",
    paymentmethod: "paymentMethod",
    receiptdate: "date",
    remarks: "notes",
    shop: "vendor",
    store: "vendor",
    supplier: "vendor",
    total: "amount",
    type: "category",
    vendorname: "vendor",
  },
  payments: {
    amount: "amount",
    billno: "invoiceNumber",
    billnumber: "invoiceNumber",
    customer: "customerName",
    customername: "customerName",
    date: "paymentDate",
    invoice: "invoiceNumber",
    invoiceno: "invoiceNumber",
    invoicenumber: "invoiceNumber",
    method: "paymentMethod",
    mode: "paymentMethod",
    paidamount: "amount",
    paidon: "paymentDate",
    payment: "amount",
    paymentamount: "amount",
    paymentdate: "paymentDate",
    paymentmethod: "paymentMethod",
    receiptno: "invoiceNumber",
    reference: "notes",
    remarks: "notes",
  },
  inventory: {
    adjustment: "movementType",
    code: "productSku",
    cost: "unitCost",
    item: "productName",
    itemcode: "productSku",
    itemname: "productName",
    movement: "movementType",
    movementtype: "movementType",
    notes: "notes",
    product: "productName",
    productcode: "productSku",
    productname: "productName",
    productsku: "productSku",
    qty: "quantity",
    quantity: "quantity",
    sku: "productSku",
    stock: "quantity",
    stockqty: "quantity",
    type: "movementType",
    unitcost: "unitCost",
  },
};

function mappedColumnName(header: string, importType: ImportType) {
  const compact = compactFieldName(header);
  const allowedField = mappedFieldsByImportType[importType].find(
    (fieldName) => compactFieldName(fieldName) === compact,
  );

  return allowedField ?? columnAliases[importType][compact] ?? normalizeFieldName(header);
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let currentCell = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && isQuoted && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (character === "," && !isQuoted) {
      cells.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  cells.push(currentCell.trim());

  return cells;
}

function csvRows(textContent: string) {
  const rows = textContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);

  return {
    headers: rows[0] ?? [],
    rows: rows.slice(1),
  };
}

function textPreview(textContent: string) {
  const compactText = textContent.replace(/\s+/g, " ").trim();

  return compactText.slice(0, 700);
}

function placeholderFields(
  importType: ImportType,
  skippedFields = new Set<string>(),
): ExtractedFieldInput[] {
  return mappedFieldsByImportType[importType]
    .filter((fieldName) => !skippedFields.has(fieldName))
    .map((fieldName) => ({
      confidence: new Prisma.Decimal(0),
      extractedValue: null,
      fieldName,
      status: "needs_review",
    }));
}

function metadataFields({
  extractionSource,
  extractionWarning,
  fileName,
  fileSize,
  fileType,
  rowNumber,
  sheetName,
}: {
  extractionSource?: string;
  extractionWarning?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  rowNumber?: number;
  sheetName?: string;
}): ExtractedFieldInput[] {
  return [
    {
      confidence: new Prisma.Decimal(1),
      extractedValue: fileName,
      fieldName: "source_file_name",
      status: "extracted",
    },
    {
      confidence: new Prisma.Decimal(1),
      extractedValue: fileType || "unknown",
      fieldName: "source_file_type",
      status: "extracted",
    },
    {
      confidence: new Prisma.Decimal(1),
      extractedValue: String(fileSize),
      fieldName: "source_file_size_bytes",
      status: "extracted",
    },
    ...(extractionSource
      ? [
          {
            confidence: new Prisma.Decimal(1),
            extractedValue: extractionSource,
            fieldName: "source_extraction",
            status: "extracted",
          },
        ]
      : []),
    ...(sheetName
      ? [
          {
            confidence: new Prisma.Decimal(1),
            extractedValue: sheetName,
            fieldName: "source_sheet_name",
            status: "extracted",
          },
        ]
      : []),
    ...(rowNumber
      ? [
          {
            confidence: new Prisma.Decimal(1),
            extractedValue: String(rowNumber),
            fieldName: "source_row_number",
            status: "extracted",
          },
        ]
      : []),
    ...(extractionWarning
      ? [
          {
            confidence: new Prisma.Decimal(0.25),
            extractedValue: extractionWarning,
            fieldName: "extraction_warning",
            status: "needs_review",
          },
        ]
      : []),
  ];
}

function averageConfidence(fields: ExtractedFieldInput[]) {
  if (fields.length === 0) {
    return new Prisma.Decimal(0);
  }

  const total = fields.reduce(
    (currentTotal, field) => currentTotal.plus(field.confidence),
    new Prisma.Decimal(0),
  );

  return total.div(fields.length).toDecimalPlaces(2);
}

export function buildInitialExtractedFields({
  extractionConfidence,
  extractionSource,
  extractionWarning,
  fileName,
  fileSize,
  fileType,
  importType,
  textContent,
}: InitialExtractionInput): ExtractedFieldInput[] {
  const baseMetadataFields = metadataFields({
    extractionSource,
    extractionWarning,
    fileName,
    fileSize,
    fileType,
  });

  if (fileType === "text/csv" || fileName.toLowerCase().endsWith(".csv")) {
    const { headers, rows } = csvRows(textContent);
    const values = rows[0] ?? [];
    const csvFields = headers.map((header, index) => ({
      confidence: new Prisma.Decimal(values[index] ? 0.75 : 0.5),
      extractedValue: values[index] ?? null,
      fieldName: mappedColumnName(header, importType),
      status: values[index] ? "extracted" : "needs_review",
    }));

    if (csvFields.length > 0) {
      return [...baseMetadataFields, ...csvFields];
    }
  }

  if (textContent.trim()) {
    const inferredFields = inferFieldsFromText({
      confidence: extractionConfidence,
      importType,
      textContent,
    });
    const inferredFieldNames = new Set(
      inferredFields.map((field) => field.fieldName),
    );

    return [
      ...baseMetadataFields,
      {
        confidence: new Prisma.Decimal(extractionConfidence ?? 0.6),
        extractedValue: textPreview(textContent),
        fieldName: "extracted_text_preview",
        status: "needs_review",
      },
      ...inferredFields,
      ...placeholderFields(importType, inferredFieldNames),
    ];
  }

  return [...baseMetadataFields, ...placeholderFields(importType)];
}

function inferredField(
  fieldName: string,
  extractedValue: string | null,
  confidence: number,
): ExtractedFieldInput | null {
  if (!extractedValue) {
    return null;
  }

  return {
    confidence: new Prisma.Decimal(confidence),
    extractedValue,
    fieldName,
    status: confidence >= 0.75 ? "extracted" : "needs_review",
  };
}

function inferInvoiceLineItemsFromText({
  confidence,
  textContent,
}: {
  confidence?: number;
  textContent: string;
}) {
  return inferSmartInvoiceLineItemsFromText({ confidence, textContent });
}

function fieldsForInvoiceLine(line: SmartInvoiceLine): ExtractedFieldInput[] {
  return [
    inferredField("productName", line.productName, line.confidence),
    inferredField("itemDescription", line.itemDescription, line.confidence - 0.05),
    inferredField("quantity", line.quantity, line.confidence),
    inferredField("unitPrice", line.unitPrice, line.confidence),
  ].filter((field): field is ExtractedFieldInput => Boolean(field));
}

function smartFieldToExtractedField(field: SmartExtractedField): ExtractedFieldInput {
  return {
    confidence: new Prisma.Decimal(field.confidence),
    extractedValue: field.extractedValue,
    fieldName: field.fieldName,
    status: field.status,
  };
}

function inferFieldsFromText({
  confidence,
  importType,
  textContent,
}: {
  confidence?: number;
  importType: ImportType;
  textContent: string;
}): ExtractedFieldInput[] {
  return inferSmartFieldsFromText({
    confidence,
    importType,
    textContent,
  }).map(smartFieldToExtractedField);
}

export function extractedFieldsToParsedJson(fields: ExtractedFieldInput[]) {
  return JSON.stringify(
    fields.reduce<Record<string, string | null>>((currentFields, field) => {
      currentFields[field.fieldName] = field.extractedValue;
      return currentFields;
    }, {}),
  );
}

export function buildInitialImportedDocumentSeeds(
  input: InitialExtractionInput,
): ImportedDocumentSeed[] {
  if (
    input.fileBuffer &&
    (input.fileType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      input.fileName.toLowerCase().endsWith(".xlsx"))
  ) {
    const workbook = XLSX.read(input.fileBuffer, {
      cellDates: true,
      raw: false,
      type: "buffer",
    });
    const documentSeeds = workbook.SheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
        blankrows: false,
        defval: "",
        header: 1,
        raw: false,
      });
      const headerIndex = rows.findIndex((row) =>
        row.some((cell) => String(cell).trim()),
      );

      if (headerIndex === -1) {
        return [];
      }

      const headers = rows[headerIndex].map((header) => String(header).trim());
      const dataRows = rows
        .slice(headerIndex + 1)
        .map((row, index) => ({
          row,
          rowNumber: headerIndex + index + 2,
        }))
        .filter(({ row }) => row.some((cell) => String(cell).trim()));

      return dataRows.map(({ row, rowNumber }) => {
        const fields = [
          ...metadataFields({
            extractionSource: input.extractionSource ?? "xlsx_workbook",
            fileName: input.fileName,
            fileSize: input.fileSize,
            fileType: input.fileType,
            rowNumber,
            sheetName,
          }),
          ...headers.map((header, headerIndex) => {
            const value = String(row[headerIndex] ?? "").trim();
            const fieldName = mappedColumnName(header, input.importType);
            const isMapped =
              mappedFieldsByImportType[input.importType].includes(fieldName);

            return {
              confidence: new Prisma.Decimal(value ? (isMapped ? 0.88 : 0.65) : 0.5),
              extractedValue: value || null,
              fieldName,
              status: value ? "extracted" : "needs_review",
            };
          }),
        ];

        return {
          confidenceScore: averageConfidence(fields),
          extractedText: [headers.join(","), row.join(",")].join("\n"),
          fields,
          originalFileName: `${input.fileName} / ${sheetName} row ${rowNumber}`,
          parsedJson: extractedFieldsToParsedJson(fields),
        };
      });
    });

    if (documentSeeds.length > 0) {
      return documentSeeds;
    }
  }

  if (
    input.textContent.trim() &&
    (input.fileType === "text/csv" || input.fileName.toLowerCase().endsWith(".csv"))
  ) {
    const { headers, rows } = csvRows(input.textContent);

    if (headers.length > 0 && rows.length > 0) {
      return rows.map((row, index) => {
        const fields = [
          ...metadataFields({
            extractionSource: input.extractionSource ?? "csv_rows",
            fileName: input.fileName,
            fileSize: input.fileSize,
            fileType: input.fileType,
            rowNumber: index + 2,
          }),
          ...headers.map((header, headerIndex) => ({
            confidence: new Prisma.Decimal(row[headerIndex] ? 0.75 : 0.5),
            extractedValue: row[headerIndex] ?? null,
            fieldName: mappedColumnName(header, input.importType),
            status: row[headerIndex] ? "extracted" : "needs_review",
          })),
        ];

        return {
          confidenceScore: averageConfidence(fields),
          extractedText: [headers.join(","), row.join(",")].join("\n"),
          fields,
          originalFileName: `${input.fileName} row ${index + 2}`,
          parsedJson: extractedFieldsToParsedJson(fields),
        };
      });
    }
  }

  if (input.importType === "invoices" && input.textContent.trim()) {
    const invoiceLineItems = inferInvoiceLineItemsFromText({
      confidence: input.extractionConfidence,
      textContent: input.textContent,
    });

    if (invoiceLineItems.length > 0) {
      const invoiceHeaderFields = inferFieldsFromText({
        confidence: input.extractionConfidence,
        importType: input.importType,
        textContent: input.textContent,
      });

      return invoiceLineItems.map((lineItem, index) => {
        const lineFields = fieldsForInvoiceLine(lineItem);
        const headerFieldsForRow = index === 0 ? invoiceHeaderFields : [];
        const includedFieldNames = new Set(
          [...headerFieldsForRow, ...lineFields].map((field) => field.fieldName),
        );
        const fields = [
          ...metadataFields({
            extractionSource: input.extractionSource ?? "ocr_line_items",
            extractionWarning: index === 0 ? input.extractionWarning : undefined,
            fileName: input.fileName,
            fileSize: input.fileSize,
            fileType: input.fileType,
            rowNumber: index + 1,
          }),
          ...(index === 0
            ? [
                {
                  confidence: new Prisma.Decimal(input.extractionConfidence ?? 0.6),
                  extractedValue: textPreview(input.textContent),
                  fieldName: "extracted_text_preview",
                  status: "needs_review",
                },
                ...headerFieldsForRow,
              ]
            : []),
          ...lineFields,
          ...placeholderFields(input.importType, includedFieldNames),
        ];

        return {
          confidenceScore: averageConfidence(fields),
          extractedText: input.textContent.slice(0, 4000),
          fields,
          originalFileName: `${input.fileName} line ${index + 1}`,
          parsedJson: extractedFieldsToParsedJson(fields),
        };
      });
    }
  }

  const fields = buildInitialExtractedFields(input);

  return [
    {
      confidenceScore: averageConfidence(fields),
      extractedText: input.textContent ? input.textContent.slice(0, 4000) : null,
      fields,
      originalFileName: input.fileName,
      parsedJson: extractedFieldsToParsedJson(fields),
    },
  ];
}
