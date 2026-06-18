import "server-only";

import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

import { prisma } from "@/app/_backend/lib/db/prisma";

type ReportValue = boolean | Date | number | string | null | undefined;
type ReportRow = Record<string, ReportValue>;

type ReportFormat = "currency" | "date" | "decimal" | "integer" | "text";

type ReportSheet = {
  columns?: string[];
  name: string;
  rows: ReportRow[];
  title?: string;
  totals?: string[];
};

type ReportExport = {
  buffer: Buffer;
  filename: string;
  format: "xlsx";
  reportName: string;
  rowCount: number;
};

type DateRangeFilters = {
  from?: string | null;
  to?: string | null;
};

type InventoryReportFilters = DateRangeFilters & {
  productId?: string | null;
  type?: string | null;
};

type ReceivablesReportFilters = {
  asOf?: string | null;
};

type ProductProfitabilityFilters = DateRangeFilters;

type TaxSummaryFilters = DateRangeFilters;

type SalesTrendMode = "daily" | "monthly";

type SalesTrendFilters = DateRangeFilters & {
  mode?: string | null;
};

type ExpenseTrendFilters = DateRangeFilters & {
  mode?: string | null;
};

type CustomerSalesFilters = DateRangeFilters;

type ExpenseCategoryFilters = DateRangeFilters;

type VendorExpenseFilters = DateRangeFilters;

type PaymentCollectionFilters = DateRangeFilters;

type StockValuationFilters = {
  status?: string | null;
};

type ReportExportAuditInput = {
  businessId: string;
  exportFile: ReportExport;
  filters: Record<string, string | null | undefined>;
  userId?: string | null;
};

export type ProductProfitabilityRow = {
  category: string | null;
  cost: number;
  discount: number;
  grossSales: number;
  invoiceCount: number;
  itemName: string;
  lowStockAlert: number | null;
  margin: number;
  netCost: number;
  netQuantity: number;
  netRevenue: number;
  productId: string | null;
  profit: number;
  quantityRefunded: number;
  quantitySold: number;
  refundCount: number;
  refundRevenue: number;
  sku: string | null;
  stockQuantity: number | null;
  taxCollected: number;
  unit: string | null;
};

export type ProductProfitabilityReport = {
  business: {
    currency: string;
    name: string;
  };
  fromInput: string;
  rows: ProductProfitabilityRow[];
  toInput: string;
  totals: {
    cost: number;
    grossSales: number;
    invoiceCount: number;
    netCost: number;
    netQuantity: number;
    netRevenue: number;
    profit: number;
    quantityRefunded: number;
    quantitySold: number;
    refundCount: number;
    refundRevenue: number;
    taxCollected: number;
  };
};

export type TaxSummaryRow = {
  grossSales: number;
  invoiceCount: number;
  netTax: number;
  netTaxableSales: number;
  refundCount: number;
  refundedTax: number;
  refundedTaxableSales: number;
  taxCollected: number;
  taxableSales: number;
  taxRate: number;
};

export type TaxSummaryReport = {
  business: {
    currency: string;
    name: string;
  };
  fromInput: string;
  rows: TaxSummaryRow[];
  toInput: string;
  totals: {
    grossSales: number;
    invoiceCount: number;
    netTax: number;
    netTaxableSales: number;
    refundCount: number;
    refundedTax: number;
    refundedTaxableSales: number;
    taxCollected: number;
    taxableSales: number;
  };
};

export type SalesTrendRow = {
  averageInvoiceValue: number;
  balanceAmount: number;
  grossSales: number;
  invoiceCount: number;
  netSales: number;
  paymentsReceived: number;
  periodEnd: Date;
  periodKey: string;
  periodLabel: string;
  refundAmount: number;
  refundCount: number;
};

export type SalesTrendReport = {
  business: {
    currency: string;
    name: string;
  };
  fromInput: string;
  mode: SalesTrendMode;
  rows: SalesTrendRow[];
  toInput: string;
  totals: {
    averageInvoiceValue: number;
    balanceAmount: number;
    grossSales: number;
    invoiceCount: number;
    netSales: number;
    paymentsReceived: number;
    refundAmount: number;
    refundCount: number;
  };
};

export type ExpenseTrendRow = {
  averageExpenseAmount: number;
  expenseCount: number;
  periodEnd: Date;
  periodKey: string;
  periodLabel: string;
  topCategory: string | null;
  topCategoryAmount: number;
  topPaymentMethod: string | null;
  topPaymentMethodAmount: number;
  topVendor: string | null;
  topVendorAmount: number;
  totalAmount: number;
};

export type ExpenseTrendReport = {
  business: {
    currency: string;
    name: string;
  };
  fromInput: string;
  mode: SalesTrendMode;
  rows: ExpenseTrendRow[];
  toInput: string;
  totals: {
    averageExpenseAmount: number;
    expenseCount: number;
    totalAmount: number;
  };
};

export type CustomerSalesRow = {
  averageInvoiceValue: number;
  balanceAmount: number;
  businessName: string | null;
  customerId: string | null;
  customerName: string;
  email: string | null;
  grossSales: number;
  invoiceCount: number;
  lastInvoiceDate: Date | null;
  netSales: number;
  paidAmount: number;
  paymentsReceived: number;
  phone: string | null;
  refundAmount: number;
  refundCount: number;
};

export type CustomerSalesReport = {
  business: {
    currency: string;
    name: string;
  };
  fromInput: string;
  rows: CustomerSalesRow[];
  toInput: string;
  totals: {
    averageInvoiceValue: number;
    balanceAmount: number;
    customerCount: number;
    grossSales: number;
    invoiceCount: number;
    netSales: number;
    paidAmount: number;
    paymentsReceived: number;
    refundAmount: number;
    refundCount: number;
  };
};

export type ExpenseCategoryRow = {
  averageExpenseAmount: number;
  category: string;
  expenseCount: number;
  lastExpenseDate: Date | null;
  percentOfExpenses: number;
  topPaymentMethod: string | null;
  topPaymentMethodAmount: number;
  topVendor: string | null;
  topVendorAmount: number;
  totalAmount: number;
};

export type ExpenseCategoryDetailRow = {
  amount: number;
  category: string;
  date: Date;
  notes: string | null;
  paymentMethod: string | null;
  vendor: string | null;
};

export type ExpenseCategoryReport = {
  business: {
    currency: string;
    name: string;
  };
  detailRows: ExpenseCategoryDetailRow[];
  fromInput: string;
  rows: ExpenseCategoryRow[];
  toInput: string;
  totals: {
    averageExpenseAmount: number;
    categoryCount: number;
    expenseCount: number;
    totalAmount: number;
  };
};

export type VendorExpenseRow = {
  averageExpenseAmount: number;
  expenseCount: number;
  lastExpenseDate: Date | null;
  percentOfExpenses: number;
  topCategory: string | null;
  topCategoryAmount: number;
  topPaymentMethod: string | null;
  topPaymentMethodAmount: number;
  totalAmount: number;
  vendor: string;
};

export type VendorExpenseDetailRow = {
  amount: number;
  category: string;
  date: Date;
  notes: string | null;
  paymentMethod: string | null;
  vendor: string;
};

export type VendorExpenseReport = {
  business: {
    currency: string;
    name: string;
  };
  detailRows: VendorExpenseDetailRow[];
  fromInput: string;
  rows: VendorExpenseRow[];
  toInput: string;
  totals: {
    averageExpenseAmount: number;
    expenseCount: number;
    totalAmount: number;
    vendorCount: number;
  };
};

export type PaymentCollectionMethodRow = {
  averagePaymentAmount: number;
  lastPaymentDate: Date | null;
  paymentCount: number;
  paymentMethod: string;
  percentOfCollection: number;
  totalAmount: number;
};

export type PaymentCollectionCustomerRow = {
  businessName: string | null;
  customerId: string | null;
  customerName: string;
  email: string | null;
  invoiceCount: number;
  lastPaymentDate: Date | null;
  paymentCount: number;
  phone: string | null;
  totalAmount: number;
};

export type PaymentCollectionDetailRow = {
  amount: number;
  balanceAmount: number;
  businessName: string | null;
  customerId: string | null;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  notes: string | null;
  paymentDate: Date;
  paymentMethod: string;
};

export type PaymentCollectionReport = {
  business: {
    currency: string;
    name: string;
  };
  customerRows: PaymentCollectionCustomerRow[];
  detailRows: PaymentCollectionDetailRow[];
  fromInput: string;
  methodRows: PaymentCollectionMethodRow[];
  toInput: string;
  totals: {
    averagePaymentAmount: number;
    customerCount: number;
    methodCount: number;
    paymentCount: number;
    totalAmount: number;
  };
};

export type StockValuationRow = {
  category: string | null;
  costPrice: number;
  lowStockAlert: number;
  productId: string;
  productName: string;
  salePrice: number;
  sku: string | null;
  status: string;
  stockQuantity: number;
  stockStatus: "healthy" | "low_stock" | "negative_stock" | "out_of_stock";
  stockValue: number;
  unit: string | null;
};

export type StockValuationReport = {
  business: {
    currency: string;
    name: string;
  };
  rows: StockValuationRow[];
  selectedStatus: string;
  totals: {
    activeItems: number;
    healthyItems: number;
    lowStockItems: number;
    negativeStockItems: number;
    outOfStockItems: number;
    totalCostValue: number;
    totalRetailValue: number;
    totalUnits: number;
  };
};

type AgingBucket =
  | "current"
  | "days1to30"
  | "days31to60"
  | "days61to90"
  | "days90plus";

const agingBucketLabels: Record<AgingBucket, string> = {
  current: "Current",
  days1to30: "1-30",
  days31to60: "31-60",
  days61to90: "61-90",
  days90plus: "90+",
};

const movementTypeOptions = [
  "stock_in",
  "stock_out",
  "adjustment",
  "invoice_deduction",
  "refund_return",
] as const;

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const now = new Date();

  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function parseDate(value: string | null | undefined, fallback: Date, endOfDay = false) {
  if (!value) {
    return fallback;
  }

  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(`${value}${suffix}`);

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function parseOptionalDate(value: string | null | undefined, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(`${value}${suffix}`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseAsOfDate(value: string | null | undefined) {
  return parseDate(value, new Date(), true);
}

function daysBetween(later: Date, earlier: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const laterDay = Date.UTC(
    later.getFullYear(),
    later.getMonth(),
    later.getDate(),
  );
  const earlierDay = Date.UTC(
    earlier.getFullYear(),
    earlier.getMonth(),
    earlier.getDate(),
  );

  return Math.floor((laterDay - earlierDay) / millisecondsPerDay);
}

function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) {
    return "current";
  }

  if (daysOverdue <= 30) {
    return "days1to30";
  }

  if (daysOverdue <= 60) {
    return "days31to60";
  }

  if (daysOverdue <= 90) {
    return "days61to90";
  }

  return "days90plus";
}

function emptyBuckets() {
  return {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
  } satisfies Record<AgingBucket, number>;
}

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 10000) / 100;
}

function decimalNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function methodLabel(value: string) {
  return value.replace(/_/g, " ");
}

function movementTypeLabel(value: string) {
  return value.replace(/_/g, " ");
}

function humanizeColumn(column: string) {
  return column
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function exportFilename(businessName: string, reportName: string) {
  const businessSlug = businessName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const reportSlug = reportName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${businessSlug || "business"}-${reportSlug}-${dateStamp()}.xlsx`;
}

function columnFormat(column: string): ReportFormat {
  if (/(^|_)date$|created_at|generated_at/.test(column)) {
    return "date";
  }

  if (/count|records|invoices|customers|items|moves/.test(column)) {
    return "integer";
  }

  if (/alert|margin|percent|quantity|rate|restocked|stock|units/.test(column)) {
    return "decimal";
  }

  if (
    /amount|balance|cost|expense|paid|payment|price|profit|receivable|refund|revenue|sales|taxable|tax|total|valuation|value/.test(
      column,
    )
  ) {
    return "currency";
  }

  return "text";
}

function numberFormat(format: ReportFormat) {
  if (format === "date") {
    return "yyyy-mm-dd";
  }

  if (format === "integer") {
    return "0";
  }

  if (format === "currency" || format === "decimal") {
    return "#,##0.00";
  }

  return undefined;
}

function applyCellFormats(
  worksheet: XLSX.WorkSheet,
  columns: string[],
  firstDataRow: number,
  lastDataRow: number,
) {
  for (let rowIndex = firstDataRow; rowIndex <= lastDataRow; rowIndex += 1) {
    columns.forEach((column, columnIndex) => {
      const cellRef = XLSX.utils.encode_cell({
        c: columnIndex,
        r: rowIndex,
      });
      const cell = worksheet[cellRef];
      const format = numberFormat(columnFormat(column));

      if (cell && format) {
        cell.z = format;
      }
    });
  }
}

function totalsRow(columns: string[], rows: ReportRow[], totalColumns: string[]) {
  return columns.map((column, index) => {
    if (index === 0) {
      return "Total";
    }

    if (!totalColumns.includes(column)) {
      return "";
    }

    return rows.reduce((total, row) => {
      const value = row[column];

      return typeof value === "number" ? total + value : total;
    }, 0);
  });
}

function worksheetFromRows(sheet: ReportSheet) {
  const columns =
    sheet.columns ??
    Array.from(
      sheet.rows.reduce((headers, row) => {
        for (const key of Object.keys(row)) {
          headers.add(key);
        }

        return headers;
      }, new Set<string>()),
    );
  const title = sheet.title ?? sheet.name;
  const headerRowIndex = 2;
  const dataStartRowIndex = headerRowIndex + 1;
  const aoa: ReportValue[][] = [
    [title],
    [],
    columns.length > 0 ? columns.map(humanizeColumn) : ["No records found"],
  ];

  if (sheet.rows.length === 0) {
    aoa.push(["No records found"]);
  } else {
    aoa.push(...sheet.rows.map((row) => columns.map((column) => row[column] ?? "")));

    if (sheet.totals && sheet.totals.length > 0) {
      aoa.push(totalsRow(columns, sheet.rows, sheet.totals));
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa, {
    cellDates: true,
  });
  const visibleColumns = columns.length > 0 ? columns : ["No records found"];
  worksheet["!cols"] = visibleColumns.map((column) => {
    const longestValue = Math.max(
      humanizeColumn(column).length,
      ...sheet.rows.map((row) => String(row[column] ?? "").length),
    );

    return {
      wch: Math.min(Math.max(longestValue + 2, 12), 42),
    };
  });
  worksheet["!merges"] = [
    {
      e: {
        c: Math.max(visibleColumns.length - 1, 0),
        r: 0,
      },
      s: {
        c: 0,
        r: 0,
      },
    },
  ];
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      e: {
        c: Math.max(visibleColumns.length - 1, 0),
        r: Math.max(aoa.length - 1, headerRowIndex),
      },
      s: {
        c: 0,
        r: headerRowIndex,
      },
    }),
  };

  if (sheet.rows.length > 0) {
    applyCellFormats(worksheet, columns, dataStartRowIndex, aoa.length - 1);
  }

  return worksheet;
}

function workbookBuffer(sheets: ReportSheet[]) {
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

async function getBusiness(businessId: string) {
  return prisma.business.findUniqueOrThrow({
    select: {
      currency: true,
      name: true,
    },
    where: {
      id: businessId,
    },
  });
}

function reportExport(
  businessName: string,
  reportName: string,
  sheets: ReportSheet[],
): ReportExport {
  return {
    buffer: workbookBuffer(sheets),
    filename: exportFilename(businessName, reportName),
    format: "xlsx",
    reportName,
    rowCount: sheets.reduce((total, sheet) => total + sheet.rows.length, 0),
  };
}

function summaryRows(rows: Array<[string, ReportValue, ReportValue?]>) {
  return rows.map(([metric, value, notes]) => ({
    metric,
    notes,
    value,
  }));
}

export async function recordReportExportAudit({
  businessId,
  exportFile,
  filters,
  userId,
}: ReportExportAuditInput) {
  await prisma.exportAuditLog.create({
    data: {
      businessId,
      createdById: userId,
      exportType: "report",
      filename: exportFile.filename,
      filtersJson: JSON.stringify(filters),
      format: exportFile.format,
      reportName: exportFile.reportName,
      rowCount: exportFile.rowCount,
      status: "completed",
    },
  });
}

function profitabilityKey(productId: string | null | undefined, itemName: string) {
  return productId ?? `item:${itemName.trim().toLowerCase() || "unknown"}`;
}

function refundNetAmount(refundAmount: number, taxRate: number) {
  if (taxRate <= 0) {
    return refundAmount;
  }

  return refundAmount / (1 + taxRate / 100);
}

export async function buildProductProfitabilityReportData(
  businessId: string,
  filters: ProductProfitabilityFilters,
): Promise<ProductProfitabilityReport> {
  const business = await getBusiness(businessId);
  const defaults = defaultDateRange();
  const fromDate = parseDate(filters.from, defaults.from);
  const toDate = parseDate(filters.to, defaults.to, true);
  const fromInput = filters.from ?? dateInputValue(defaults.from);
  const toInput = filters.to ?? dateInputValue(defaults.to);
  const productRows = new Map<
    string,
    ProductProfitabilityRow & {
      invoiceIds: Set<string>;
      refundIds: Set<string>;
    }
  >();

  const [invoiceItems, refundItems] = await Promise.all([
    prisma.invoiceItem.findMany({
      include: {
        invoice: {
          select: {
            id: true,
            invoiceDate: true,
            invoiceNumber: true,
          },
        },
        product: {
          select: {
            category: true,
            costPrice: true,
            id: true,
            lowStockAlert: true,
            name: true,
            sku: true,
            stockQuantity: true,
            unit: true,
          },
        },
      },
      orderBy: [
        {
          product: {
            name: "asc",
          },
        },
        {
          itemName: "asc",
        },
      ],
      where: {
        invoice: {
          businessId,
          invoiceDate: {
            gte: fromDate,
            lte: toDate,
          },
          status: "finalized",
        },
      },
    }),
    prisma.refundItem.findMany({
      include: {
        invoiceItem: {
          select: {
            taxRate: true,
          },
        },
        product: {
          select: {
            category: true,
            costPrice: true,
            id: true,
            lowStockAlert: true,
            name: true,
            sku: true,
            stockQuantity: true,
            unit: true,
          },
        },
        refund: {
          select: {
            id: true,
            refundDate: true,
            refundNumber: true,
          },
        },
      },
      orderBy: {
        refund: {
          refundDate: "desc",
        },
      },
      where: {
        refund: {
          businessId,
          refundDate: {
            gte: fromDate,
            lte: toDate,
          },
          status: "completed",
        },
      },
    }),
  ]);

  function rowFor({
    category,
    itemName,
    lowStockAlert,
    productId,
    sku,
    stockQuantity,
    unit,
  }: {
    category: string | null;
    itemName: string;
    lowStockAlert: number | null;
    productId: string | null;
    sku: string | null;
    stockQuantity: number | null;
    unit: string | null;
  }) {
    const key = profitabilityKey(productId, itemName);
    const existing = productRows.get(key);

    if (existing) {
      return existing;
    }

    const row = {
      category,
      cost: 0,
      discount: 0,
      grossSales: 0,
      invoiceCount: 0,
      invoiceIds: new Set<string>(),
      itemName,
      lowStockAlert,
      margin: 0,
      netCost: 0,
      netQuantity: 0,
      netRevenue: 0,
      productId,
      profit: 0,
      quantityRefunded: 0,
      quantitySold: 0,
      refundCount: 0,
      refundIds: new Set<string>(),
      refundRevenue: 0,
      sku,
      stockQuantity,
      taxCollected: 0,
      unit,
    };

    productRows.set(key, row);

    return row;
  }

  for (const item of invoiceItems) {
    const quantity = decimalNumber(item.quantity);
    const unitPrice = decimalNumber(item.unitPrice);
    const discount = decimalNumber(item.discount);
    const taxAmount = decimalNumber(item.taxAmount);
    const lineTotal = decimalNumber(item.lineTotal);
    const costPrice = decimalNumber(item.product?.costPrice);
    const row = rowFor({
      category: item.product?.category ?? null,
      itemName: item.product?.name ?? item.itemName,
      lowStockAlert: item.product ? decimalNumber(item.product.lowStockAlert) : null,
      productId: item.product?.id ?? item.productId,
      sku: item.product?.sku ?? null,
      stockQuantity: item.product ? decimalNumber(item.product.stockQuantity) : null,
      unit: item.product?.unit ?? item.unit,
    });

    row.quantitySold += quantity;
    row.grossSales += quantity * unitPrice;
    row.discount += discount;
    row.netRevenue += lineTotal - taxAmount;
    row.taxCollected += taxAmount;
    row.cost += quantity * costPrice;
    row.invoiceIds.add(item.invoice.id);
  }

  for (const item of refundItems) {
    const quantity = decimalNumber(item.quantity);
    const refundAmount = decimalNumber(item.refundAmount);
    const taxRate = decimalNumber(item.invoiceItem.taxRate);
    const refundRevenue = refundNetAmount(refundAmount, taxRate);
    const costPrice = decimalNumber(item.product?.costPrice);
    const row = rowFor({
      category: item.product?.category ?? null,
      itemName: item.product?.name ?? item.itemName,
      lowStockAlert: item.product ? decimalNumber(item.product.lowStockAlert) : null,
      productId: item.product?.id ?? item.productId,
      sku: item.product?.sku ?? null,
      stockQuantity: item.product ? decimalNumber(item.product.stockQuantity) : null,
      unit: item.product?.unit ?? null,
    });

    row.quantityRefunded += quantity;
    row.refundRevenue += refundRevenue;
    row.netRevenue -= refundRevenue;
    row.cost -= quantity * costPrice;
    row.refundIds.add(item.refund.id);
  }

  const rows = [...productRows.values()].map((row) => {
    const netQuantity = row.quantitySold - row.quantityRefunded;
    const netCost = row.cost;
    const profit = row.netRevenue - netCost;

    return {
      category: row.category,
      cost: row.cost,
      discount: row.discount,
      grossSales: row.grossSales,
      invoiceCount: row.invoiceIds.size,
      itemName: row.itemName,
      lowStockAlert: row.lowStockAlert,
      margin: row.netRevenue > 0 ? percent(profit, row.netRevenue) : 0,
      netCost,
      netQuantity,
      netRevenue: row.netRevenue,
      productId: row.productId,
      profit,
      quantityRefunded: row.quantityRefunded,
      quantitySold: row.quantitySold,
      refundCount: row.refundIds.size,
      refundRevenue: row.refundRevenue,
      sku: row.sku,
      stockQuantity: row.stockQuantity,
      taxCollected: row.taxCollected,
      unit: row.unit,
    };
  });

  rows.sort((left, right) => right.profit - left.profit);

  const totals = rows.reduce(
    (currentTotals, row) => ({
      cost: currentTotals.cost + row.cost,
      grossSales: currentTotals.grossSales + row.grossSales,
      invoiceCount: currentTotals.invoiceCount + row.invoiceCount,
      netCost: currentTotals.netCost + row.netCost,
      netQuantity: currentTotals.netQuantity + row.netQuantity,
      netRevenue: currentTotals.netRevenue + row.netRevenue,
      profit: currentTotals.profit + row.profit,
      quantityRefunded:
        currentTotals.quantityRefunded + row.quantityRefunded,
      quantitySold: currentTotals.quantitySold + row.quantitySold,
      refundCount: currentTotals.refundCount + row.refundCount,
      refundRevenue: currentTotals.refundRevenue + row.refundRevenue,
      taxCollected: currentTotals.taxCollected + row.taxCollected,
    }),
    {
      cost: 0,
      grossSales: 0,
      invoiceCount: 0,
      netCost: 0,
      netQuantity: 0,
      netRevenue: 0,
      profit: 0,
      quantityRefunded: 0,
      quantitySold: 0,
      refundCount: 0,
      refundRevenue: 0,
      taxCollected: 0,
    },
  );

  return {
    business,
    fromInput,
    rows,
    toInput,
    totals,
  };
}

export async function buildProductProfitabilityReportXlsx(
  businessId: string,
  filters: ProductProfitabilityFilters,
): Promise<ReportExport> {
  const report = await buildProductProfitabilityReportData(businessId, filters);
  const overallMargin =
    report.totals.netRevenue > 0
      ? percent(report.totals.profit, report.totals.netRevenue)
      : 0;

  return reportExport(report.business.name, "product-profitability-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Product profitability"],
        ["Business", report.business.name],
        ["Currency", report.business.currency],
        ["From", report.fromInput],
        ["To", report.toInput],
        ["Generated at", new Date()],
        ["Products sold", report.rows.length],
        ["Quantity sold", report.totals.quantitySold],
        ["Quantity refunded", report.totals.quantityRefunded],
        ["Net quantity", report.totals.netQuantity],
        ["Net product revenue", report.totals.netRevenue],
        ["Estimated cost", report.totals.netCost],
        ["Estimated profit", report.totals.profit],
        ["Profit margin %", overallMargin],
        ["Tax collected", report.totals.taxCollected],
      ]),
    },
    {
      columns: [
        "product_name",
        "sku",
        "category",
        "unit",
        "quantity_sold",
        "quantity_refunded",
        "net_quantity",
        "gross_sales",
        "discount",
        "refund_revenue",
        "net_revenue",
        "tax_collected",
        "estimated_cost",
        "estimated_profit",
        "margin_percent",
        "invoice_count",
        "refund_count",
        "stock_quantity",
        "low_stock_alert",
      ],
      name: "Product Profitability",
      rows: report.rows.map((row) => ({
        category: row.category,
        discount: row.discount,
        estimated_cost: row.netCost,
        estimated_profit: row.profit,
        gross_sales: row.grossSales,
        invoice_count: row.invoiceCount,
        low_stock_alert: row.lowStockAlert,
        margin_percent: row.margin,
        net_quantity: row.netQuantity,
        net_revenue: row.netRevenue,
        product_name: row.itemName,
        quantity_refunded: row.quantityRefunded,
        quantity_sold: row.quantitySold,
        refund_count: row.refundCount,
        refund_revenue: row.refundRevenue,
        sku: row.sku,
        stock_quantity: row.stockQuantity,
        tax_collected: row.taxCollected,
        unit: row.unit,
      })),
      totals: [
        "quantity_sold",
        "quantity_refunded",
        "net_quantity",
        "gross_sales",
        "discount",
        "refund_revenue",
        "net_revenue",
        "tax_collected",
        "estimated_cost",
        "estimated_profit",
        "invoice_count",
        "refund_count",
      ],
    },
  ]);
}

function taxRateKey(taxRate: number) {
  return taxRate.toFixed(4);
}

export async function buildTaxSummaryReportData(
  businessId: string,
  filters: TaxSummaryFilters,
): Promise<TaxSummaryReport> {
  const business = await getBusiness(businessId);
  const defaults = defaultDateRange();
  const fromDate = parseDate(filters.from, defaults.from);
  const toDate = parseDate(filters.to, defaults.to, true);
  const fromInput = filters.from ?? dateInputValue(defaults.from);
  const toInput = filters.to ?? dateInputValue(defaults.to);
  const taxRows = new Map<
    string,
    TaxSummaryRow & {
      invoiceIds: Set<string>;
      refundIds: Set<string>;
    }
  >();

  const [invoiceItems, refundItems] = await Promise.all([
    prisma.invoiceItem.findMany({
      include: {
        invoice: {
          select: {
            id: true,
          },
        },
      },
      where: {
        invoice: {
          businessId,
          invoiceDate: {
            gte: fromDate,
            lte: toDate,
          },
          status: "finalized",
        },
      },
    }),
    prisma.refundItem.findMany({
      include: {
        invoiceItem: {
          select: {
            taxRate: true,
          },
        },
        refund: {
          select: {
            id: true,
          },
        },
      },
      where: {
        refund: {
          businessId,
          refundDate: {
            gte: fromDate,
            lte: toDate,
          },
          status: "completed",
        },
      },
    }),
  ]);

  function rowFor(taxRate: number) {
    const key = taxRateKey(taxRate);
    const existing = taxRows.get(key);

    if (existing) {
      return existing;
    }

    const row = {
      grossSales: 0,
      invoiceCount: 0,
      invoiceIds: new Set<string>(),
      netTax: 0,
      netTaxableSales: 0,
      refundCount: 0,
      refundIds: new Set<string>(),
      refundedTax: 0,
      refundedTaxableSales: 0,
      taxCollected: 0,
      taxableSales: 0,
      taxRate,
    };

    taxRows.set(key, row);

    return row;
  }

  for (const item of invoiceItems) {
    const taxRate = decimalNumber(item.taxRate);
    const quantity = decimalNumber(item.quantity);
    const unitPrice = decimalNumber(item.unitPrice);
    const taxAmount = decimalNumber(item.taxAmount);
    const lineTotal = decimalNumber(item.lineTotal);
    const taxableSales = lineTotal - taxAmount;
    const row = rowFor(taxRate);

    row.grossSales += quantity * unitPrice;
    row.taxableSales += taxableSales;
    row.taxCollected += taxAmount;
    row.netTaxableSales += taxableSales;
    row.netTax += taxAmount;
    row.invoiceIds.add(item.invoice.id);
  }

  for (const item of refundItems) {
    const taxRate = decimalNumber(item.invoiceItem.taxRate);
    const refundAmount = decimalNumber(item.refundAmount);
    const refundedTaxableSales = refundNetAmount(refundAmount, taxRate);
    const refundedTax = refundAmount - refundedTaxableSales;
    const row = rowFor(taxRate);

    row.refundedTaxableSales += refundedTaxableSales;
    row.refundedTax += refundedTax;
    row.netTaxableSales -= refundedTaxableSales;
    row.netTax -= refundedTax;
    row.refundIds.add(item.refund.id);
  }

  const rows = [...taxRows.values()].map((row) => ({
    grossSales: row.grossSales,
    invoiceCount: row.invoiceIds.size,
    netTax: row.netTax,
    netTaxableSales: row.netTaxableSales,
    refundCount: row.refundIds.size,
    refundedTax: row.refundedTax,
    refundedTaxableSales: row.refundedTaxableSales,
    taxCollected: row.taxCollected,
    taxableSales: row.taxableSales,
    taxRate: row.taxRate,
  }));

  rows.sort((left, right) => left.taxRate - right.taxRate);

  const totals = rows.reduce(
    (currentTotals, row) => ({
      grossSales: currentTotals.grossSales + row.grossSales,
      invoiceCount: currentTotals.invoiceCount + row.invoiceCount,
      netTax: currentTotals.netTax + row.netTax,
      netTaxableSales:
        currentTotals.netTaxableSales + row.netTaxableSales,
      refundCount: currentTotals.refundCount + row.refundCount,
      refundedTax: currentTotals.refundedTax + row.refundedTax,
      refundedTaxableSales:
        currentTotals.refundedTaxableSales + row.refundedTaxableSales,
      taxCollected: currentTotals.taxCollected + row.taxCollected,
      taxableSales: currentTotals.taxableSales + row.taxableSales,
    }),
    {
      grossSales: 0,
      invoiceCount: 0,
      netTax: 0,
      netTaxableSales: 0,
      refundCount: 0,
      refundedTax: 0,
      refundedTaxableSales: 0,
      taxCollected: 0,
      taxableSales: 0,
    },
  );

  return {
    business,
    fromInput,
    rows,
    toInput,
    totals,
  };
}

export async function buildTaxSummaryReportXlsx(
  businessId: string,
  filters: TaxSummaryFilters,
): Promise<ReportExport> {
  const report = await buildTaxSummaryReportData(businessId, filters);

  return reportExport(report.business.name, "tax-summary-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Tax summary"],
        ["Business", report.business.name],
        ["Currency", report.business.currency],
        ["From", report.fromInput],
        ["To", report.toInput],
        ["Generated at", new Date()],
        ["Gross sales", report.totals.grossSales],
        ["Taxable sales", report.totals.taxableSales],
        ["Tax collected", report.totals.taxCollected],
        ["Refunded taxable sales", report.totals.refundedTaxableSales],
        ["Refunded tax", report.totals.refundedTax],
        ["Net taxable sales", report.totals.netTaxableSales],
        ["Net tax", report.totals.netTax],
        ["Tax rates", report.rows.length],
      ]),
    },
    {
      columns: [
        "tax_rate",
        "gross_sales",
        "taxable_sales",
        "tax_collected",
        "refunded_taxable_sales",
        "refunded_tax",
        "net_taxable_sales",
        "net_tax",
        "invoice_count",
        "refund_count",
      ],
      name: "Tax By Rate",
      rows: report.rows.map((row) => ({
        gross_sales: row.grossSales,
        invoice_count: row.invoiceCount,
        net_tax: row.netTax,
        net_taxable_sales: row.netTaxableSales,
        refund_count: row.refundCount,
        refunded_tax: row.refundedTax,
        refunded_taxable_sales: row.refundedTaxableSales,
        tax_collected: row.taxCollected,
        tax_rate: row.taxRate,
        taxable_sales: row.taxableSales,
      })),
      totals: [
        "gross_sales",
        "taxable_sales",
        "tax_collected",
        "refunded_taxable_sales",
        "refunded_tax",
        "net_taxable_sales",
        "net_tax",
        "invoice_count",
        "refund_count",
      ],
    },
  ]);
}

function salesTrendMode(value: string | null | undefined): SalesTrendMode {
  return value === "monthly" ? "monthly" : "daily";
}

function periodStart(date: Date, mode: SalesTrendMode) {
  if (mode === "monthly") {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function periodEnd(date: Date, mode: SalesTrendMode) {
  if (mode === "monthly") {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function periodKey(date: Date, mode: SalesTrendMode) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  if (mode === "monthly") {
    return `${year}-${month}`;
  }

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function periodLabel(date: Date, mode: SalesTrendMode) {
  if (mode === "monthly") {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      year: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export async function buildSalesTrendReportData(
  businessId: string,
  filters: SalesTrendFilters,
): Promise<SalesTrendReport> {
  const business = await getBusiness(businessId);
  const mode = salesTrendMode(filters.mode);
  const defaults = defaultDateRange();
  const fromDate = parseDate(filters.from, defaults.from);
  const toDate = parseDate(filters.to, defaults.to, true);
  const fromInput = filters.from ?? dateInputValue(defaults.from);
  const toInput = filters.to ?? dateInputValue(defaults.to);
  const periodRows = new Map<string, SalesTrendRow>();

  function rowFor(date: Date) {
    const key = periodKey(date, mode);
    const existing = periodRows.get(key);

    if (existing) {
      return existing;
    }

    const start = periodStart(date, mode);
    const row = {
      averageInvoiceValue: 0,
      balanceAmount: 0,
      grossSales: 0,
      invoiceCount: 0,
      netSales: 0,
      paymentsReceived: 0,
      periodEnd: periodEnd(date, mode),
      periodKey: key,
      periodLabel: periodLabel(start, mode),
      refundAmount: 0,
      refundCount: 0,
    };

    periodRows.set(key, row);

    return row;
  }

  const [invoices, payments, refunds] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: {
        invoiceDate: "asc",
      },
      where: {
        businessId,
        invoiceDate: {
          gte: fromDate,
          lte: toDate,
        },
        status: "finalized",
      },
    }),
    prisma.payment.findMany({
      orderBy: {
        paymentDate: "asc",
      },
      where: {
        businessId,
        paymentDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
    }),
    prisma.refund.findMany({
      orderBy: {
        refundDate: "asc",
      },
      where: {
        businessId,
        refundDate: {
          gte: fromDate,
          lte: toDate,
        },
        status: "completed",
      },
    }),
  ]);

  for (const invoice of invoices) {
    const row = rowFor(invoice.invoiceDate);

    row.invoiceCount += 1;
    row.grossSales += decimalNumber(invoice.grandTotal);
    row.balanceAmount += decimalNumber(invoice.balanceAmount);
  }

  for (const payment of payments) {
    const row = rowFor(payment.paymentDate);

    row.paymentsReceived += decimalNumber(payment.amount);
  }

  for (const refund of refunds) {
    const row = rowFor(refund.refundDate);

    row.refundAmount += decimalNumber(refund.amount);
    row.refundCount += 1;
  }

  const rows = [...periodRows.values()]
    .map((row) => ({
      ...row,
      averageInvoiceValue:
        row.invoiceCount > 0 ? row.grossSales / row.invoiceCount : 0,
      netSales: row.grossSales - row.refundAmount,
    }))
    .sort((left, right) => left.periodKey.localeCompare(right.periodKey));

  const totals = rows.reduce(
    (currentTotals, row) => ({
      averageInvoiceValue: 0,
      balanceAmount: currentTotals.balanceAmount + row.balanceAmount,
      grossSales: currentTotals.grossSales + row.grossSales,
      invoiceCount: currentTotals.invoiceCount + row.invoiceCount,
      netSales: currentTotals.netSales + row.netSales,
      paymentsReceived:
        currentTotals.paymentsReceived + row.paymentsReceived,
      refundAmount: currentTotals.refundAmount + row.refundAmount,
      refundCount: currentTotals.refundCount + row.refundCount,
    }),
    {
      averageInvoiceValue: 0,
      balanceAmount: 0,
      grossSales: 0,
      invoiceCount: 0,
      netSales: 0,
      paymentsReceived: 0,
      refundAmount: 0,
      refundCount: 0,
    },
  );
  totals.averageInvoiceValue =
    totals.invoiceCount > 0 ? totals.grossSales / totals.invoiceCount : 0;

  return {
    business,
    fromInput,
    mode,
    rows,
    toInput,
    totals,
  };
}

export async function buildSalesTrendReportXlsx(
  businessId: string,
  filters: SalesTrendFilters,
): Promise<ReportExport> {
  const report = await buildSalesTrendReportData(businessId, filters);

  return reportExport(report.business.name, "daily-monthly-sales-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Daily / monthly sales"],
        ["Business", report.business.name],
        ["Currency", report.business.currency],
        ["Mode", report.mode],
        ["From", report.fromInput],
        ["To", report.toInput],
        ["Generated at", new Date()],
        ["Gross sales", report.totals.grossSales],
        ["Refunds", report.totals.refundAmount],
        ["Net sales", report.totals.netSales],
        ["Payments received", report.totals.paymentsReceived],
        ["Outstanding balance", report.totals.balanceAmount],
        ["Invoice count", report.totals.invoiceCount],
        ["Average invoice value", report.totals.averageInvoiceValue],
      ]),
    },
    {
      columns: [
        "period",
        "period_start",
        "period_end",
        "invoice_count",
        "gross_sales",
        "refund_count",
        "refund_amount",
        "net_sales",
        "payments_received",
        "outstanding_balance",
        "average_invoice_value",
      ],
      name: "Sales Trend",
      rows: report.rows.map((row) => ({
        average_invoice_value: row.averageInvoiceValue,
        gross_sales: row.grossSales,
        invoice_count: row.invoiceCount,
        net_sales: row.netSales,
        outstanding_balance: row.balanceAmount,
        payments_received: row.paymentsReceived,
        period: row.periodLabel,
        period_end: row.periodEnd,
        period_start: periodStart(row.periodEnd, report.mode),
        refund_amount: row.refundAmount,
        refund_count: row.refundCount,
      })),
      totals: [
        "invoice_count",
        "gross_sales",
        "refund_count",
        "refund_amount",
        "net_sales",
        "payments_received",
        "outstanding_balance",
      ],
    },
  ]);
}

export async function buildExpenseTrendReportData(
  businessId: string,
  filters: ExpenseTrendFilters,
): Promise<ExpenseTrendReport> {
  const business = await getBusiness(businessId);
  const mode = salesTrendMode(filters.mode);
  const defaults = defaultDateRange();
  const fromDate = parseDate(filters.from, defaults.from);
  const toDate = parseDate(filters.to, defaults.to, true);
  const fromInput = filters.from ?? dateInputValue(defaults.from);
  const toInput = filters.to ?? dateInputValue(defaults.to);
  const periodRows = new Map<
    string,
    ExpenseTrendRow & {
      categories: Map<string, number>;
      paymentMethods: Map<string, number>;
      vendors: Map<string, number>;
    }
  >();

  function rowFor(date: Date) {
    const key = periodKey(date, mode);
    const existing = periodRows.get(key);

    if (existing) {
      return existing;
    }

    const start = periodStart(date, mode);
    const row = {
      averageExpenseAmount: 0,
      categories: new Map<string, number>(),
      expenseCount: 0,
      paymentMethods: new Map<string, number>(),
      periodEnd: periodEnd(date, mode),
      periodKey: key,
      periodLabel: periodLabel(start, mode),
      topCategory: null,
      topCategoryAmount: 0,
      topPaymentMethod: null,
      topPaymentMethodAmount: 0,
      topVendor: null,
      topVendorAmount: 0,
      totalAmount: 0,
      vendors: new Map<string, number>(),
    } satisfies ExpenseTrendRow & {
      categories: Map<string, number>;
      paymentMethods: Map<string, number>;
      vendors: Map<string, number>;
    };

    periodRows.set(key, row);

    return row;
  }

  const expenses = await prisma.expense.findMany({
    orderBy: {
      date: "asc",
    },
    select: {
      amount: true,
      category: true,
      date: true,
      paymentMethod: true,
      vendor: true,
    },
    where: {
      businessId,
      date: {
        gte: fromDate,
        lte: toDate,
      },
      status: "active",
    },
  });

  for (const expense of expenses) {
    const amount = decimalNumber(expense.amount);
    const category = expense.category.trim() || "Uncategorized";
    const row = rowFor(expense.date);

    row.expenseCount += 1;
    row.totalAmount += amount;
    row.categories.set(category, (row.categories.get(category) ?? 0) + amount);

    if (expense.vendor?.trim()) {
      const vendor = expense.vendor.trim();
      row.vendors.set(vendor, (row.vendors.get(vendor) ?? 0) + amount);
    }

    if (expense.paymentMethod?.trim()) {
      const method = methodLabel(expense.paymentMethod.trim());
      row.paymentMethods.set(
        method,
        (row.paymentMethods.get(method) ?? 0) + amount,
      );
    }
  }

  const rows = [...periodRows.values()]
    .map((row) => {
      const topCategory = topExpenseBreakdownValue(row.categories);
      const topPaymentMethod = topExpenseBreakdownValue(row.paymentMethods);
      const topVendor = topExpenseBreakdownValue(row.vendors);

      return {
        averageExpenseAmount:
          row.expenseCount > 0 ? row.totalAmount / row.expenseCount : 0,
        expenseCount: row.expenseCount,
        periodEnd: row.periodEnd,
        periodKey: row.periodKey,
        periodLabel: row.periodLabel,
        topCategory: topCategory.label,
        topCategoryAmount: topCategory.amount,
        topPaymentMethod: topPaymentMethod.label,
        topPaymentMethodAmount: topPaymentMethod.amount,
        topVendor: topVendor.label,
        topVendorAmount: topVendor.amount,
        totalAmount: row.totalAmount,
      };
    })
    .sort((left, right) => left.periodKey.localeCompare(right.periodKey));

  const totals = rows.reduce(
    (currentTotals, row) => ({
      averageExpenseAmount: 0,
      expenseCount: currentTotals.expenseCount + row.expenseCount,
      totalAmount: currentTotals.totalAmount + row.totalAmount,
    }),
    {
      averageExpenseAmount: 0,
      expenseCount: 0,
      totalAmount: 0,
    },
  );
  totals.averageExpenseAmount =
    totals.expenseCount > 0 ? totals.totalAmount / totals.expenseCount : 0;

  return {
    business,
    fromInput,
    mode,
    rows,
    toInput,
    totals,
  };
}

export async function buildExpenseTrendReportXlsx(
  businessId: string,
  filters: ExpenseTrendFilters,
): Promise<ReportExport> {
  const report = await buildExpenseTrendReportData(businessId, filters);

  return reportExport(report.business.name, "expense-trends-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Expense trends"],
        ["Business", report.business.name],
        ["Currency", report.business.currency],
        ["Mode", report.mode],
        ["From", report.fromInput],
        ["To", report.toInput],
        ["Generated at", new Date()],
        ["Total expenses", report.totals.totalAmount],
        ["Expense records", report.totals.expenseCount],
        ["Average expense", report.totals.averageExpenseAmount],
      ]),
    },
    {
      columns: [
        "period",
        "period_start",
        "period_end",
        "expense_count",
        "total_amount",
        "average_expense_amount",
        "top_category",
        "top_category_amount",
        "top_vendor",
        "top_vendor_amount",
        "top_payment_method",
        "top_payment_method_amount",
      ],
      name: "Expense Trends",
      rows: report.rows.map((row) => ({
        average_expense_amount: row.averageExpenseAmount,
        expense_count: row.expenseCount,
        period: row.periodLabel,
        period_end: row.periodEnd,
        period_start: periodStart(row.periodEnd, report.mode),
        top_category: row.topCategory,
        top_category_amount: row.topCategoryAmount,
        top_payment_method: row.topPaymentMethod,
        top_payment_method_amount: row.topPaymentMethodAmount,
        top_vendor: row.topVendor,
        top_vendor_amount: row.topVendorAmount,
        total_amount: row.totalAmount,
      })),
      totals: [
        "expense_count",
        "total_amount",
        "top_category_amount",
        "top_vendor_amount",
        "top_payment_method_amount",
      ],
    },
  ]);
}

function customerSalesKey(customerId: string | null | undefined) {
  return customerId ?? "no-customer";
}

function buildEmptyCustomerSalesRow(
  customer:
    | {
        businessName: string | null;
        email: string | null;
        id: string;
        name: string;
        phone: string | null;
      }
    | null
    | undefined,
): CustomerSalesRow {
  return {
    averageInvoiceValue: 0,
    balanceAmount: 0,
    businessName: customer?.businessName ?? null,
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? "No customer",
    email: customer?.email ?? null,
    grossSales: 0,
    invoiceCount: 0,
    lastInvoiceDate: null,
    netSales: 0,
    paidAmount: 0,
    paymentsReceived: 0,
    phone: customer?.phone ?? null,
    refundAmount: 0,
    refundCount: 0,
  };
}

function updateCustomerSalesContact(
  row: CustomerSalesRow,
  customer:
    | {
        businessName: string | null;
        email: string | null;
        id: string;
        name: string;
        phone: string | null;
      }
    | null
    | undefined,
) {
  if (!customer) {
    return;
  }

  row.businessName ??= customer.businessName;
  row.email ??= customer.email;
  row.phone ??= customer.phone;
}

export async function buildCustomerSalesReportData(
  businessId: string,
  filters: CustomerSalesFilters,
): Promise<CustomerSalesReport> {
  const business = await getBusiness(businessId);
  const defaults = defaultDateRange();
  const fromDate = parseDate(filters.from, defaults.from);
  const toDate = parseDate(filters.to, defaults.to, true);
  const fromInput = filters.from ?? dateInputValue(defaults.from);
  const toInput = filters.to ?? dateInputValue(defaults.to);
  const customerSelect = {
    businessName: true,
    email: true,
    id: true,
    name: true,
    phone: true,
  } satisfies Prisma.CustomerSelect;
  const rowsByCustomer = new Map<string, CustomerSalesRow>();

  function rowFor(
    customer:
      | {
          businessName: string | null;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
        }
      | null
      | undefined,
  ) {
    const key = customerSalesKey(customer?.id);
    const existing = rowsByCustomer.get(key);

    if (existing) {
      updateCustomerSalesContact(existing, customer);

      return existing;
    }

    const row = buildEmptyCustomerSalesRow(customer);
    rowsByCustomer.set(key, row);

    return row;
  }

  const [invoices, payments, refunds] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: {
        invoiceDate: "desc",
      },
      select: {
        balanceAmount: true,
        customer: {
          select: customerSelect,
        },
        grandTotal: true,
        invoiceDate: true,
        paidAmount: true,
      },
      where: {
        businessId,
        invoiceDate: {
          gte: fromDate,
          lte: toDate,
        },
        status: "finalized",
      },
    }),
    prisma.payment.findMany({
      orderBy: {
        paymentDate: "desc",
      },
      select: {
        amount: true,
        invoice: {
          select: {
            customer: {
              select: customerSelect,
            },
          },
        },
      },
      where: {
        businessId,
        paymentDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
    }),
    prisma.refund.findMany({
      orderBy: {
        refundDate: "desc",
      },
      select: {
        amount: true,
        customer: {
          select: customerSelect,
        },
        invoice: {
          select: {
            customer: {
              select: customerSelect,
            },
          },
        },
      },
      where: {
        businessId,
        refundDate: {
          gte: fromDate,
          lte: toDate,
        },
        status: "completed",
      },
    }),
  ]);

  for (const invoice of invoices) {
    const row = rowFor(invoice.customer);

    row.balanceAmount += decimalNumber(invoice.balanceAmount);
    row.grossSales += decimalNumber(invoice.grandTotal);
    row.invoiceCount += 1;
    row.lastInvoiceDate =
      row.lastInvoiceDate && row.lastInvoiceDate > invoice.invoiceDate
        ? row.lastInvoiceDate
        : invoice.invoiceDate;
    row.paidAmount += decimalNumber(invoice.paidAmount);
  }

  for (const payment of payments) {
    const row = rowFor(payment.invoice.customer);

    row.paymentsReceived += decimalNumber(payment.amount);
  }

  for (const refund of refunds) {
    const customer = refund.customer ?? refund.invoice.customer;
    const row = rowFor(customer);

    row.refundAmount += decimalNumber(refund.amount);
    row.refundCount += 1;
  }

  const rows = [...rowsByCustomer.values()]
    .map((row) => ({
      ...row,
      averageInvoiceValue:
        row.invoiceCount > 0 ? row.grossSales / row.invoiceCount : 0,
      netSales: row.grossSales - row.refundAmount,
    }))
    .sort((left, right) => {
      const salesSort = right.netSales - left.netSales;

      return salesSort === 0
        ? left.customerName.localeCompare(right.customerName)
        : salesSort;
    });

  const totals = rows.reduce(
    (currentTotals, row) => ({
      averageInvoiceValue: 0,
      balanceAmount: currentTotals.balanceAmount + row.balanceAmount,
      customerCount: currentTotals.customerCount + 1,
      grossSales: currentTotals.grossSales + row.grossSales,
      invoiceCount: currentTotals.invoiceCount + row.invoiceCount,
      netSales: currentTotals.netSales + row.netSales,
      paidAmount: currentTotals.paidAmount + row.paidAmount,
      paymentsReceived:
        currentTotals.paymentsReceived + row.paymentsReceived,
      refundAmount: currentTotals.refundAmount + row.refundAmount,
      refundCount: currentTotals.refundCount + row.refundCount,
    }),
    {
      averageInvoiceValue: 0,
      balanceAmount: 0,
      customerCount: 0,
      grossSales: 0,
      invoiceCount: 0,
      netSales: 0,
      paidAmount: 0,
      paymentsReceived: 0,
      refundAmount: 0,
      refundCount: 0,
    },
  );
  totals.averageInvoiceValue =
    totals.invoiceCount > 0 ? totals.grossSales / totals.invoiceCount : 0;

  return {
    business,
    fromInput,
    rows,
    toInput,
    totals,
  };
}

export async function buildCustomerSalesReportXlsx(
  businessId: string,
  filters: CustomerSalesFilters,
): Promise<ReportExport> {
  const report = await buildCustomerSalesReportData(businessId, filters);

  return reportExport(report.business.name, "customer-wise-sales-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Customer-wise sales"],
        ["Business", report.business.name],
        ["Currency", report.business.currency],
        ["From", report.fromInput],
        ["To", report.toInput],
        ["Generated at", new Date()],
        ["Customers", report.totals.customerCount],
        ["Invoice count", report.totals.invoiceCount],
        ["Gross sales", report.totals.grossSales],
        ["Refunds", report.totals.refundAmount],
        ["Net sales", report.totals.netSales],
        ["Paid on invoices", report.totals.paidAmount],
        ["Payments received", report.totals.paymentsReceived],
        ["Outstanding balance", report.totals.balanceAmount],
        ["Average invoice value", report.totals.averageInvoiceValue],
      ]),
    },
    {
      columns: [
        "customer",
        "business_name",
        "phone",
        "email",
        "invoice_count",
        "gross_sales",
        "refund_count",
        "refund_amount",
        "net_sales",
        "paid_amount",
        "payments_received",
        "outstanding_balance",
        "average_invoice_value",
        "last_invoice_date",
      ],
      name: "Customer Sales",
      rows: report.rows.map((row) => ({
        average_invoice_value: row.averageInvoiceValue,
        business_name: row.businessName,
        customer: row.customerName,
        email: row.email,
        gross_sales: row.grossSales,
        invoice_count: row.invoiceCount,
        last_invoice_date: row.lastInvoiceDate,
        net_sales: row.netSales,
        outstanding_balance: row.balanceAmount,
        paid_amount: row.paidAmount,
        payments_received: row.paymentsReceived,
        phone: row.phone,
        refund_amount: row.refundAmount,
        refund_count: row.refundCount,
      })),
      totals: [
        "invoice_count",
        "gross_sales",
        "refund_count",
        "refund_amount",
        "net_sales",
        "paid_amount",
        "payments_received",
        "outstanding_balance",
      ],
    },
  ]);
}

function topExpenseBreakdownValue(values: Map<string, number>) {
  const [topEntry] = [...values.entries()].sort(
    (left, right) => right[1] - left[1],
  );

  return topEntry
    ? {
        amount: topEntry[1],
        label: topEntry[0],
      }
    : {
        amount: 0,
        label: null,
      };
}

export async function buildExpenseCategoryReportData(
  businessId: string,
  filters: ExpenseCategoryFilters,
): Promise<ExpenseCategoryReport> {
  const business = await getBusiness(businessId);
  const defaults = defaultDateRange();
  const fromDate = parseDate(filters.from, defaults.from);
  const toDate = parseDate(filters.to, defaults.to, true);
  const fromInput = filters.from ?? dateInputValue(defaults.from);
  const toInput = filters.to ?? dateInputValue(defaults.to);
  const expenses = await prisma.expense.findMany({
    orderBy: {
      date: "desc",
    },
    select: {
      amount: true,
      category: true,
      date: true,
      notes: true,
      paymentMethod: true,
      vendor: true,
    },
    where: {
      businessId,
      date: {
        gte: fromDate,
        lte: toDate,
      },
      status: "active",
    },
  });
  const totals = {
    averageExpenseAmount: 0,
    categoryCount: 0,
    expenseCount: expenses.length,
    totalAmount: 0,
  };
  const categoryRows = new Map<
    string,
    ExpenseCategoryRow & {
      paymentMethods: Map<string, number>;
      vendors: Map<string, number>;
    }
  >();

  for (const expense of expenses) {
    const amount = decimalNumber(expense.amount);
    const category = expense.category.trim() || "Uncategorized";
    const existing = categoryRows.get(category);
    const row =
      existing ??
      ({
        averageExpenseAmount: 0,
        category,
        expenseCount: 0,
        lastExpenseDate: null,
        paymentMethods: new Map<string, number>(),
        percentOfExpenses: 0,
        topPaymentMethod: null,
        topPaymentMethodAmount: 0,
        topVendor: null,
        topVendorAmount: 0,
        totalAmount: 0,
        vendors: new Map<string, number>(),
      } satisfies ExpenseCategoryRow & {
        paymentMethods: Map<string, number>;
        vendors: Map<string, number>;
      });

    row.expenseCount += 1;
    row.totalAmount += amount;
    row.lastExpenseDate =
      row.lastExpenseDate && row.lastExpenseDate > expense.date
        ? row.lastExpenseDate
        : expense.date;

    if (expense.vendor?.trim()) {
      const vendor = expense.vendor.trim();
      row.vendors.set(vendor, (row.vendors.get(vendor) ?? 0) + amount);
    }

    if (expense.paymentMethod?.trim()) {
      const method = methodLabel(expense.paymentMethod.trim());
      row.paymentMethods.set(
        method,
        (row.paymentMethods.get(method) ?? 0) + amount,
      );
    }

    categoryRows.set(category, row);
    totals.totalAmount += amount;
  }

  const rows = [...categoryRows.values()]
    .map((row) => {
      const topVendor = topExpenseBreakdownValue(row.vendors);
      const topPaymentMethod = topExpenseBreakdownValue(row.paymentMethods);

      return {
        averageExpenseAmount:
          row.expenseCount > 0 ? row.totalAmount / row.expenseCount : 0,
        category: row.category,
        expenseCount: row.expenseCount,
        lastExpenseDate: row.lastExpenseDate,
        percentOfExpenses: percent(row.totalAmount, totals.totalAmount),
        topPaymentMethod: topPaymentMethod.label,
        topPaymentMethodAmount: topPaymentMethod.amount,
        topVendor: topVendor.label,
        topVendorAmount: topVendor.amount,
        totalAmount: row.totalAmount,
      };
    })
    .sort((left, right) => {
      const amountSort = right.totalAmount - left.totalAmount;

      return amountSort === 0
        ? left.category.localeCompare(right.category)
        : amountSort;
    });

  totals.averageExpenseAmount =
    totals.expenseCount > 0 ? totals.totalAmount / totals.expenseCount : 0;
  totals.categoryCount = rows.length;

  return {
    business,
    detailRows: expenses.map((expense) => ({
      amount: decimalNumber(expense.amount),
      category: expense.category.trim() || "Uncategorized",
      date: expense.date,
      notes: expense.notes,
      paymentMethod: expense.paymentMethod
        ? methodLabel(expense.paymentMethod)
        : null,
      vendor: expense.vendor,
    })),
    fromInput,
    rows,
    toInput,
    totals,
  };
}

export async function buildExpenseCategoryReportXlsx(
  businessId: string,
  filters: ExpenseCategoryFilters,
): Promise<ReportExport> {
  const report = await buildExpenseCategoryReportData(businessId, filters);

  return reportExport(report.business.name, "expense-category-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Expense category"],
        ["Business", report.business.name],
        ["Currency", report.business.currency],
        ["From", report.fromInput],
        ["To", report.toInput],
        ["Generated at", new Date()],
        ["Total expenses", report.totals.totalAmount],
        ["Expense records", report.totals.expenseCount],
        ["Categories", report.totals.categoryCount],
        ["Average expense", report.totals.averageExpenseAmount],
      ]),
    },
    {
      columns: [
        "category",
        "expense_count",
        "total_amount",
        "percent_of_expenses",
        "average_expense_amount",
        "last_expense_date",
        "top_vendor",
        "top_vendor_amount",
        "top_payment_method",
        "top_payment_method_amount",
      ],
      name: "Expense Categories",
      rows: report.rows.map((row) => ({
        average_expense_amount: row.averageExpenseAmount,
        category: row.category,
        expense_count: row.expenseCount,
        last_expense_date: row.lastExpenseDate,
        percent_of_expenses: row.percentOfExpenses,
        top_payment_method: row.topPaymentMethod,
        top_payment_method_amount: row.topPaymentMethodAmount,
        top_vendor: row.topVendor,
        top_vendor_amount: row.topVendorAmount,
        total_amount: row.totalAmount,
      })),
      totals: [
        "expense_count",
        "total_amount",
        "top_vendor_amount",
        "top_payment_method_amount",
      ],
    },
    {
      columns: [
        "date",
        "category",
        "amount",
        "payment_method",
        "vendor",
        "notes",
      ],
      name: "Expense Detail",
      rows: report.detailRows.map((expense) => ({
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        notes: expense.notes,
        payment_method: expense.paymentMethod,
        vendor: expense.vendor,
      })),
      totals: ["amount"],
    },
  ]);
}

export async function buildVendorExpenseReportData(
  businessId: string,
  filters: VendorExpenseFilters,
): Promise<VendorExpenseReport> {
  const business = await getBusiness(businessId);
  const defaults = defaultDateRange();
  const fromDate = parseDate(filters.from, defaults.from);
  const toDate = parseDate(filters.to, defaults.to, true);
  const fromInput = filters.from ?? dateInputValue(defaults.from);
  const toInput = filters.to ?? dateInputValue(defaults.to);
  const expenses = await prisma.expense.findMany({
    orderBy: {
      date: "desc",
    },
    select: {
      amount: true,
      category: true,
      date: true,
      notes: true,
      paymentMethod: true,
      vendor: true,
    },
    where: {
      businessId,
      date: {
        gte: fromDate,
        lte: toDate,
      },
      status: "active",
    },
  });
  const totals = {
    averageExpenseAmount: 0,
    expenseCount: expenses.length,
    totalAmount: 0,
    vendorCount: 0,
  };
  const vendorRows = new Map<
    string,
    VendorExpenseRow & {
      categories: Map<string, number>;
      paymentMethods: Map<string, number>;
    }
  >();

  for (const expense of expenses) {
    const amount = decimalNumber(expense.amount);
    const vendor = expense.vendor?.trim() || "No vendor";
    const category = expense.category.trim() || "Uncategorized";
    const existing = vendorRows.get(vendor);
    const row =
      existing ??
      ({
        averageExpenseAmount: 0,
        categories: new Map<string, number>(),
        expenseCount: 0,
        lastExpenseDate: null,
        paymentMethods: new Map<string, number>(),
        percentOfExpenses: 0,
        topCategory: null,
        topCategoryAmount: 0,
        topPaymentMethod: null,
        topPaymentMethodAmount: 0,
        totalAmount: 0,
        vendor,
      } satisfies VendorExpenseRow & {
        categories: Map<string, number>;
        paymentMethods: Map<string, number>;
      });

    row.expenseCount += 1;
    row.totalAmount += amount;
    row.lastExpenseDate =
      row.lastExpenseDate && row.lastExpenseDate > expense.date
        ? row.lastExpenseDate
        : expense.date;
    row.categories.set(category, (row.categories.get(category) ?? 0) + amount);

    if (expense.paymentMethod?.trim()) {
      const method = methodLabel(expense.paymentMethod.trim());
      row.paymentMethods.set(
        method,
        (row.paymentMethods.get(method) ?? 0) + amount,
      );
    }

    vendorRows.set(vendor, row);
    totals.totalAmount += amount;
  }

  const rows = [...vendorRows.values()]
    .map((row) => {
      const topCategory = topExpenseBreakdownValue(row.categories);
      const topPaymentMethod = topExpenseBreakdownValue(row.paymentMethods);

      return {
        averageExpenseAmount:
          row.expenseCount > 0 ? row.totalAmount / row.expenseCount : 0,
        expenseCount: row.expenseCount,
        lastExpenseDate: row.lastExpenseDate,
        percentOfExpenses: percent(row.totalAmount, totals.totalAmount),
        topCategory: topCategory.label,
        topCategoryAmount: topCategory.amount,
        topPaymentMethod: topPaymentMethod.label,
        topPaymentMethodAmount: topPaymentMethod.amount,
        totalAmount: row.totalAmount,
        vendor: row.vendor,
      };
    })
    .sort((left, right) => {
      const amountSort = right.totalAmount - left.totalAmount;

      return amountSort === 0
        ? left.vendor.localeCompare(right.vendor)
        : amountSort;
    });

  totals.averageExpenseAmount =
    totals.expenseCount > 0 ? totals.totalAmount / totals.expenseCount : 0;
  totals.vendorCount = rows.length;

  return {
    business,
    detailRows: expenses.map((expense) => ({
      amount: decimalNumber(expense.amount),
      category: expense.category.trim() || "Uncategorized",
      date: expense.date,
      notes: expense.notes,
      paymentMethod: expense.paymentMethod
        ? methodLabel(expense.paymentMethod)
        : null,
      vendor: expense.vendor?.trim() || "No vendor",
    })),
    fromInput,
    rows,
    toInput,
    totals,
  };
}

export async function buildVendorExpenseReportXlsx(
  businessId: string,
  filters: VendorExpenseFilters,
): Promise<ReportExport> {
  const report = await buildVendorExpenseReportData(businessId, filters);

  return reportExport(report.business.name, "vendor-wise-expense-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Vendor-wise expense"],
        ["Business", report.business.name],
        ["Currency", report.business.currency],
        ["From", report.fromInput],
        ["To", report.toInput],
        ["Generated at", new Date()],
        ["Total expenses", report.totals.totalAmount],
        ["Expense records", report.totals.expenseCount],
        ["Vendors", report.totals.vendorCount],
        ["Average expense", report.totals.averageExpenseAmount],
      ]),
    },
    {
      columns: [
        "vendor",
        "expense_count",
        "total_amount",
        "percent_of_expenses",
        "average_expense_amount",
        "last_expense_date",
        "top_category",
        "top_category_amount",
        "top_payment_method",
        "top_payment_method_amount",
      ],
      name: "Vendor Expenses",
      rows: report.rows.map((row) => ({
        average_expense_amount: row.averageExpenseAmount,
        expense_count: row.expenseCount,
        last_expense_date: row.lastExpenseDate,
        percent_of_expenses: row.percentOfExpenses,
        top_category: row.topCategory,
        top_category_amount: row.topCategoryAmount,
        top_payment_method: row.topPaymentMethod,
        top_payment_method_amount: row.topPaymentMethodAmount,
        total_amount: row.totalAmount,
        vendor: row.vendor,
      })),
      totals: [
        "expense_count",
        "total_amount",
        "top_category_amount",
        "top_payment_method_amount",
      ],
    },
    {
      columns: [
        "date",
        "vendor",
        "category",
        "amount",
        "payment_method",
        "notes",
      ],
      name: "Expense Detail",
      rows: report.detailRows.map((expense) => ({
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        notes: expense.notes,
        payment_method: expense.paymentMethod,
        vendor: expense.vendor,
      })),
      totals: ["amount"],
    },
  ]);
}

function paymentCustomerKey(customerId: string | null | undefined) {
  return customerId ?? "no-customer";
}

export async function buildPaymentCollectionReportData(
  businessId: string,
  filters: PaymentCollectionFilters,
): Promise<PaymentCollectionReport> {
  const business = await getBusiness(businessId);
  const defaults = defaultDateRange();
  const fromDate = parseDate(filters.from, defaults.from);
  const toDate = parseDate(filters.to, defaults.to, true);
  const fromInput = filters.from ?? dateInputValue(defaults.from);
  const toInput = filters.to ?? dateInputValue(defaults.to);
  const payments = await prisma.payment.findMany({
    orderBy: {
      paymentDate: "desc",
    },
    select: {
      amount: true,
      invoice: {
        select: {
          balanceAmount: true,
          customer: {
            select: {
              businessName: true,
              email: true,
              id: true,
              name: true,
              phone: true,
            },
          },
          id: true,
          invoiceNumber: true,
        },
      },
      notes: true,
      paymentDate: true,
      paymentMethod: true,
    },
    where: {
      businessId,
      paymentDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
  });
  const totals = {
    averagePaymentAmount: 0,
    customerCount: 0,
    methodCount: 0,
    paymentCount: payments.length,
    totalAmount: 0,
  };
  const methodRows = new Map<string, PaymentCollectionMethodRow>();
  const customerRows = new Map<
    string,
    PaymentCollectionCustomerRow & { invoiceIds: Set<string> }
  >();

  for (const payment of payments) {
    const amount = decimalNumber(payment.amount);
    const paymentMethod = methodLabel(payment.paymentMethod || "cash");
    const methodRow =
      methodRows.get(paymentMethod) ??
      ({
        averagePaymentAmount: 0,
        lastPaymentDate: null,
        paymentCount: 0,
        paymentMethod,
        percentOfCollection: 0,
        totalAmount: 0,
      } satisfies PaymentCollectionMethodRow);
    const customer = payment.invoice.customer;
    const customerKey = paymentCustomerKey(customer?.id);
    const customerRow =
      customerRows.get(customerKey) ??
      ({
        businessName: customer?.businessName ?? null,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? "No customer",
        email: customer?.email ?? null,
        invoiceCount: 0,
        invoiceIds: new Set<string>(),
        lastPaymentDate: null,
        paymentCount: 0,
        phone: customer?.phone ?? null,
        totalAmount: 0,
      } satisfies PaymentCollectionCustomerRow & { invoiceIds: Set<string> });

    methodRow.paymentCount += 1;
    methodRow.totalAmount += amount;
    methodRow.lastPaymentDate =
      methodRow.lastPaymentDate &&
      methodRow.lastPaymentDate > payment.paymentDate
        ? methodRow.lastPaymentDate
        : payment.paymentDate;
    methodRows.set(paymentMethod, methodRow);

    customerRow.businessName ??= customer?.businessName ?? null;
    customerRow.email ??= customer?.email ?? null;
    customerRow.phone ??= customer?.phone ?? null;
    customerRow.invoiceIds.add(payment.invoice.id);
    customerRow.invoiceCount = customerRow.invoiceIds.size;
    customerRow.paymentCount += 1;
    customerRow.totalAmount += amount;
    customerRow.lastPaymentDate =
      customerRow.lastPaymentDate &&
      customerRow.lastPaymentDate > payment.paymentDate
        ? customerRow.lastPaymentDate
        : payment.paymentDate;
    customerRows.set(customerKey, customerRow);

    totals.totalAmount += amount;
  }

  const finalizedMethodRows = [...methodRows.values()]
    .map((row) => ({
      ...row,
      averagePaymentAmount:
        row.paymentCount > 0 ? row.totalAmount / row.paymentCount : 0,
      percentOfCollection: percent(row.totalAmount, totals.totalAmount),
    }))
    .sort((left, right) => {
      const amountSort = right.totalAmount - left.totalAmount;

      return amountSort === 0
        ? left.paymentMethod.localeCompare(right.paymentMethod)
        : amountSort;
    });
  const finalizedCustomerRows = [...customerRows.values()]
    .map((row) => ({
      businessName: row.businessName,
      customerId: row.customerId,
      customerName: row.customerName,
      email: row.email,
      invoiceCount: row.invoiceCount,
      lastPaymentDate: row.lastPaymentDate,
      paymentCount: row.paymentCount,
      phone: row.phone,
      totalAmount: row.totalAmount,
    }))
    .sort((left, right) => {
      const amountSort = right.totalAmount - left.totalAmount;

      return amountSort === 0
        ? left.customerName.localeCompare(right.customerName)
        : amountSort;
    });

  totals.averagePaymentAmount =
    totals.paymentCount > 0 ? totals.totalAmount / totals.paymentCount : 0;
  totals.customerCount = finalizedCustomerRows.length;
  totals.methodCount = finalizedMethodRows.length;

  return {
    business,
    customerRows: finalizedCustomerRows,
    detailRows: payments.map((payment) => ({
      amount: decimalNumber(payment.amount),
      balanceAmount: decimalNumber(payment.invoice.balanceAmount),
      businessName: payment.invoice.customer?.businessName ?? null,
      customerId: payment.invoice.customer?.id ?? null,
      customerName: payment.invoice.customer?.name ?? "No customer",
      invoiceId: payment.invoice.id,
      invoiceNumber: payment.invoice.invoiceNumber,
      notes: payment.notes,
      paymentDate: payment.paymentDate,
      paymentMethod: methodLabel(payment.paymentMethod || "cash"),
    })),
    fromInput,
    methodRows: finalizedMethodRows,
    toInput,
    totals,
  };
}

export async function buildPaymentCollectionReportXlsx(
  businessId: string,
  filters: PaymentCollectionFilters,
): Promise<ReportExport> {
  const report = await buildPaymentCollectionReportData(businessId, filters);

  return reportExport(report.business.name, "payment-collection-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Payment collection"],
        ["Business", report.business.name],
        ["Currency", report.business.currency],
        ["From", report.fromInput],
        ["To", report.toInput],
        ["Generated at", new Date()],
        ["Total collected", report.totals.totalAmount],
        ["Payment records", report.totals.paymentCount],
        ["Customers", report.totals.customerCount],
        ["Payment methods", report.totals.methodCount],
        ["Average payment", report.totals.averagePaymentAmount],
      ]),
    },
    {
      columns: [
        "payment_method",
        "payment_count",
        "total_amount",
        "percent_of_collection",
        "average_payment_amount",
        "last_payment_date",
      ],
      name: "Method Summary",
      rows: report.methodRows.map((row) => ({
        average_payment_amount: row.averagePaymentAmount,
        last_payment_date: row.lastPaymentDate,
        payment_count: row.paymentCount,
        payment_method: row.paymentMethod,
        percent_of_collection: row.percentOfCollection,
        total_amount: row.totalAmount,
      })),
      totals: ["payment_count", "total_amount"],
    },
    {
      columns: [
        "customer",
        "business_name",
        "phone",
        "email",
        "invoice_count",
        "payment_count",
        "total_amount",
        "last_payment_date",
      ],
      name: "Customer Collections",
      rows: report.customerRows.map((row) => ({
        business_name: row.businessName,
        customer: row.customerName,
        email: row.email,
        invoice_count: row.invoiceCount,
        last_payment_date: row.lastPaymentDate,
        payment_count: row.paymentCount,
        phone: row.phone,
        total_amount: row.totalAmount,
      })),
      totals: ["invoice_count", "payment_count", "total_amount"],
    },
    {
      columns: [
        "payment_date",
        "invoice_number",
        "customer",
        "business_name",
        "payment_method",
        "amount",
        "invoice_balance",
        "notes",
      ],
      name: "Payment Detail",
      rows: report.detailRows.map((row) => ({
        amount: row.amount,
        business_name: row.businessName,
        customer: row.customerName,
        invoice_balance: row.balanceAmount,
        invoice_number: row.invoiceNumber,
        notes: row.notes,
        payment_date: row.paymentDate,
        payment_method: row.paymentMethod,
      })),
      totals: ["amount", "invoice_balance"],
    },
  ]);
}

export async function buildProfitLossReportXlsx(
  businessId: string,
  filters: DateRangeFilters,
): Promise<ReportExport> {
  const business = await getBusiness(businessId);
  const defaults = defaultDateRange();
  const fromDate = parseDate(filters.from, defaults.from);
  const toDate = parseDate(filters.to, defaults.to, true);
  const fromInput = filters.from ?? dateInputValue(defaults.from);
  const toInput = filters.to ?? dateInputValue(defaults.to);
  const invoiceWhere: Prisma.InvoiceWhereInput = {
    businessId,
    invoiceDate: {
      gte: fromDate,
      lte: toDate,
    },
    status: "finalized",
  };
  const expenseWhere: Prisma.ExpenseWhereInput = {
    businessId,
    date: {
      gte: fromDate,
      lte: toDate,
    },
    status: "active",
  };
  const refundWhere: Prisma.RefundWhereInput = {
    businessId,
    refundDate: {
      gte: fromDate,
      lte: toDate,
    },
    status: "completed",
  };

  const [
    revenueAggregate,
    refundAggregate,
    expenseAggregate,
    invoiceCount,
    refundCount,
    expenseCount,
    openBalanceAggregate,
    categoryBreakdown,
    invoices,
    refunds,
    expenses,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: {
        grandTotal: true,
      },
      where: invoiceWhere,
    }),
    prisma.refund.aggregate({
      _sum: {
        amount: true,
      },
      where: refundWhere,
    }),
    prisma.expense.aggregate({
      _sum: {
        amount: true,
      },
      where: expenseWhere,
    }),
    prisma.invoice.count({
      where: invoiceWhere,
    }),
    prisma.refund.count({
      where: refundWhere,
    }),
    prisma.expense.count({
      where: expenseWhere,
    }),
    prisma.invoice.aggregate({
      _sum: {
        balanceAmount: true,
      },
      where: invoiceWhere,
    }),
    prisma.expense.groupBy({
      _sum: {
        amount: true,
      },
      by: ["category"],
      orderBy: {
        _sum: {
          amount: "desc",
        },
      },
      where: expenseWhere,
    }),
    prisma.invoice.findMany({
      include: {
        customer: {
          select: {
            businessName: true,
            name: true,
          },
        },
      },
      orderBy: {
        invoiceDate: "desc",
      },
      where: invoiceWhere,
    }),
    prisma.refund.findMany({
      include: {
        customer: {
          select: {
            businessName: true,
            name: true,
          },
        },
        invoice: {
          select: {
            invoiceNumber: true,
          },
        },
      },
      orderBy: {
        refundDate: "desc",
      },
      where: refundWhere,
    }),
    prisma.expense.findMany({
      orderBy: {
        date: "desc",
      },
      where: expenseWhere,
    }),
  ]);

  const grossRevenue = decimalNumber(revenueAggregate._sum.grandTotal);
  const refundTotal = decimalNumber(refundAggregate._sum.amount);
  const netRevenue = grossRevenue - refundTotal;
  const expenseTotal = decimalNumber(expenseAggregate._sum.amount);
  const profit = netRevenue - expenseTotal;
  const margin = netRevenue > 0 ? percent(profit, netRevenue) : 0;
  const openBalance = decimalNumber(openBalanceAggregate._sum.balanceAmount);
  const categoryRows = categoryBreakdown.map((category) => {
    const amount = decimalNumber(category._sum.amount);

    return {
      amount,
      category: category.category,
      percent_of_expenses: percent(amount, expenseTotal),
    };
  });

  return reportExport(business.name, "profit-loss-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Profit and loss", "Finalized invoices minus completed refunds and active expenses"],
        ["Business", business.name],
        ["Currency", business.currency],
        ["From", fromInput],
        ["To", toInput],
        ["Generated at", new Date()],
        ["Gross revenue", grossRevenue, `${invoiceCount} finalized invoices`],
        ["Refunds", refundTotal, `${refundCount} completed refunds`],
        ["Net revenue", netRevenue, "Gross revenue minus refunds"],
        ["Expenses", expenseTotal, `${expenseCount} active expenses`],
        ["Estimated profit", profit, "Net revenue minus expenses"],
        ["Profit margin %", margin],
        ["Receivables", openBalance, "Uncollected finalized invoice balance in range"],
      ]),
    },
    {
      columns: ["category", "amount", "percent_of_expenses"],
      name: "Expense Categories",
      rows: categoryRows,
      totals: ["amount"],
    },
    {
      columns: [
        "invoice_number",
        "customer_name",
        "customer_business_name",
        "invoice_date",
        "due_date",
        "grand_total",
        "paid_amount",
        "balance_amount",
      ],
      name: "Revenue Detail",
      rows: invoices.map((invoice) => ({
        balance_amount: decimalNumber(invoice.balanceAmount),
        customer_business_name: invoice.customer?.businessName,
        customer_name: invoice.customer?.name,
        due_date: invoice.dueDate,
        grand_total: decimalNumber(invoice.grandTotal),
        invoice_date: invoice.invoiceDate,
        invoice_number: invoice.invoiceNumber,
        paid_amount: decimalNumber(invoice.paidAmount),
      })),
      totals: ["grand_total", "paid_amount", "balance_amount"],
    },
    {
      columns: [
        "refund_number",
        "invoice_number",
        "customer_name",
        "customer_business_name",
        "refund_date",
        "refund_method",
        "amount",
        "reason",
        "notes",
      ],
      name: "Refund Detail",
      rows: refunds.map((refund) => ({
        amount: decimalNumber(refund.amount),
        customer_business_name: refund.customer?.businessName,
        customer_name: refund.customer?.name,
        invoice_number: refund.invoice.invoiceNumber,
        notes: refund.notes,
        reason: refund.reason,
        refund_date: refund.refundDate,
        refund_method: methodLabel(refund.refundMethod),
        refund_number: refund.refundNumber,
      })),
      totals: ["amount"],
    },
    {
      columns: [
        "date",
        "category",
        "amount",
        "payment_method",
        "vendor",
        "notes",
      ],
      name: "Expense Detail",
      rows: expenses.map((expense) => ({
        amount: decimalNumber(expense.amount),
        category: expense.category,
        date: expense.date,
        notes: expense.notes,
        payment_method: expense.paymentMethod,
        vendor: expense.vendor,
      })),
      totals: ["amount"],
    },
  ]);
}

export async function buildReceivablesReportXlsx(
  businessId: string,
  filters: ReceivablesReportFilters,
): Promise<ReportExport> {
  const business = await getBusiness(businessId);
  const asOfDate = parseAsOfDate(filters.asOf);
  const asOfInput = filters.asOf ?? dateInputValue(asOfDate);
  const invoices = await prisma.invoice.findMany({
    include: {
      customer: {
        select: {
          businessName: true,
          email: true,
          id: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: [
      {
        dueDate: "asc",
      },
      {
        invoiceDate: "asc",
      },
    ],
    where: {
      balanceAmount: {
        gt: 0,
      },
      businessId,
      invoiceDate: {
        lte: asOfDate,
      },
      status: "finalized",
    },
  });
  const invoiceRows = invoices.map((invoice) => {
    const dueDate = invoice.dueDate ?? invoice.invoiceDate;
    const daysOverdue = daysBetween(asOfDate, dueDate);
    const bucket = agingBucket(daysOverdue);
    const balance = decimalNumber(invoice.balanceAmount);

    return {
      balance,
      bucket,
      customer: invoice.customer,
      daysOverdue,
      dueDate,
      invoice,
    };
  });
  const totals = invoiceRows.reduce(
    (currentTotals, row) => {
      currentTotals.total += row.balance;
      currentTotals.buckets[row.bucket] += row.balance;

      if (row.daysOverdue > 0) {
        currentTotals.overdue += row.balance;
      }

      return currentTotals;
    },
    {
      buckets: emptyBuckets(),
      overdue: 0,
      total: 0,
    },
  );
  const customerStatements = Array.from(
    invoiceRows
      .reduce((statementMap, row) => {
        const customerKey = row.customer?.id ?? "no-customer";
        const existing = statementMap.get(customerKey) ?? {
          buckets: emptyBuckets(),
          businessName: row.customer?.businessName ?? "",
          customerId: row.customer?.id ?? "",
          email: row.customer?.email ?? "",
          invoiceCount: 0,
          name: row.customer?.name ?? "No customer",
          oldestDays: 0,
          phone: row.customer?.phone ?? "",
          total: 0,
        };

        existing.invoiceCount += 1;
        existing.total += row.balance;
        existing.buckets[row.bucket] += row.balance;
        existing.oldestDays = Math.max(existing.oldestDays, row.daysOverdue);
        statementMap.set(customerKey, existing);

        return statementMap;
      }, new Map<string, {
        buckets: Record<AgingBucket, number>;
        businessName: string;
        customerId: string;
        email: string;
        invoiceCount: number;
        name: string;
        oldestDays: number;
        phone: string;
        total: number;
      }>())
      .values(),
  ).sort((left, right) => right.total - left.total);
  const bucketRows = (Object.keys(agingBucketLabels) as AgingBucket[]).map(
    (bucket) => ({
      amount: totals.buckets[bucket],
      bucket: agingBucketLabels[bucket],
      percent_of_total: percent(totals.buckets[bucket], totals.total),
    }),
  );

  return reportExport(business.name, "receivables-aging-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Receivables aging"],
        ["Business", business.name],
        ["Currency", business.currency],
        ["As of", asOfInput],
        ["Generated at", new Date()],
        ["Total receivable", totals.total, `${invoiceRows.length} unpaid finalized invoices`],
        ["Overdue", totals.overdue, "Balance past due date"],
        ["Customer statements", customerStatements.length],
        ["90+ days", totals.buckets.days90plus],
      ]),
    },
    {
      columns: ["bucket", "amount", "percent_of_total"],
      name: "Aging Buckets",
      rows: bucketRows,
      totals: ["amount"],
    },
    {
      columns: [
        "customer_name",
        "business_name",
        "phone",
        "email",
        "total",
        "current",
        "days_1_to_30",
        "days_31_to_60",
        "days_61_to_90",
        "days_90_plus",
        "invoice_count",
        "oldest_days",
      ],
      name: "Customer Statements",
      rows: customerStatements.map((statement) => ({
        business_name: statement.businessName,
        current: statement.buckets.current,
        customer_name: statement.name,
        days_1_to_30: statement.buckets.days1to30,
        days_31_to_60: statement.buckets.days31to60,
        days_61_to_90: statement.buckets.days61to90,
        days_90_plus: statement.buckets.days90plus,
        email: statement.email,
        invoice_count: statement.invoiceCount,
        oldest_days: Math.max(statement.oldestDays, 0),
        phone: statement.phone,
        total: statement.total,
      })),
      totals: [
        "total",
        "current",
        "days_1_to_30",
        "days_31_to_60",
        "days_61_to_90",
        "days_90_plus",
        "invoice_count",
      ],
    },
    {
      columns: [
        "invoice_number",
        "customer_name",
        "business_name",
        "invoice_date",
        "due_date",
        "aging_bucket",
        "days_overdue",
        "grand_total",
        "paid_amount",
        "balance_amount",
      ],
      name: "Invoice Aging Detail",
      rows: invoiceRows.map((row) => ({
        aging_bucket: agingBucketLabels[row.bucket],
        balance_amount: row.balance,
        business_name: row.customer?.businessName,
        customer_name: row.customer?.name,
        days_overdue: Math.max(row.daysOverdue, 0),
        due_date: row.dueDate,
        grand_total: decimalNumber(row.invoice.grandTotal),
        invoice_date: row.invoice.invoiceDate,
        invoice_number: row.invoice.invoiceNumber,
        paid_amount: decimalNumber(row.invoice.paidAmount),
      })),
      totals: ["grand_total", "paid_amount", "balance_amount"],
    },
  ]);
}

function stockStatus({
  lowStockAlert,
  stockQuantity,
}: {
  lowStockAlert: number;
  stockQuantity: number;
}): StockValuationRow["stockStatus"] {
  if (stockQuantity < 0) {
    return "negative_stock";
  }

  if (stockQuantity === 0) {
    return "out_of_stock";
  }

  if (lowStockAlert > 0 && stockQuantity <= lowStockAlert) {
    return "low_stock";
  }

  return "healthy";
}

function stockStatusLabel(value: StockValuationRow["stockStatus"]) {
  return value.replace(/_/g, " ");
}

function selectedStockStatus(value: string | null | undefined) {
  return value === "active" || value === "inactive" ? value : "active";
}

export async function buildStockValuationReportData(
  businessId: string,
  filters: StockValuationFilters,
): Promise<StockValuationReport> {
  const business = await getBusiness(businessId);
  const selectedStatus = selectedStockStatus(filters.status);
  const products = await prisma.product.findMany({
    orderBy: [
      {
        status: "asc",
      },
      {
        name: "asc",
      },
    ],
    where: {
      businessId,
      status: selectedStatus,
      type: "product",
    },
  });
  const rows = products.map((product) => {
    const stockQuantity = decimalNumber(product.stockQuantity);
    const costPrice = decimalNumber(product.costPrice);
    const salePrice = decimalNumber(product.salePrice);
    const lowStockAlert = decimalNumber(product.lowStockAlert);

    return {
      category: product.category,
      costPrice,
      lowStockAlert,
      productId: product.id,
      productName: product.name,
      salePrice,
      sku: product.sku,
      status: product.status,
      stockQuantity,
      stockStatus: stockStatus({
        lowStockAlert,
        stockQuantity,
      }),
      stockValue: stockQuantity * costPrice,
      unit: product.unit,
    };
  });
  const totals = rows.reduce(
    (currentTotals, row) => ({
      activeItems:
        currentTotals.activeItems + (row.status === "active" ? 1 : 0),
      healthyItems:
        currentTotals.healthyItems + (row.stockStatus === "healthy" ? 1 : 0),
      lowStockItems:
        currentTotals.lowStockItems + (row.stockStatus === "low_stock" ? 1 : 0),
      negativeStockItems:
        currentTotals.negativeStockItems +
        (row.stockStatus === "negative_stock" ? 1 : 0),
      outOfStockItems:
        currentTotals.outOfStockItems +
        (row.stockStatus === "out_of_stock" ? 1 : 0),
      totalCostValue: currentTotals.totalCostValue + row.stockValue,
      totalRetailValue:
        currentTotals.totalRetailValue + row.stockQuantity * row.salePrice,
      totalUnits: currentTotals.totalUnits + row.stockQuantity,
    }),
    {
      activeItems: 0,
      healthyItems: 0,
      lowStockItems: 0,
      negativeStockItems: 0,
      outOfStockItems: 0,
      totalCostValue: 0,
      totalRetailValue: 0,
      totalUnits: 0,
    },
  );

  return {
    business,
    rows,
    selectedStatus,
    totals,
  };
}

export async function buildStockValuationReportXlsx(
  businessId: string,
  filters: StockValuationFilters,
): Promise<ReportExport> {
  const report = await buildStockValuationReportData(businessId, filters);

  return reportExport(report.business.name, "stock-valuation-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Stock valuation"],
        ["Business", report.business.name],
        ["Currency", report.business.currency],
        ["Status", report.selectedStatus],
        ["Generated at", new Date()],
        ["Stock items", report.rows.length],
        ["Total units", report.totals.totalUnits],
        ["Stock value at cost", report.totals.totalCostValue],
        ["Stock value at sale price", report.totals.totalRetailValue],
        ["Low stock items", report.totals.lowStockItems],
        ["Out of stock items", report.totals.outOfStockItems],
        ["Negative stock items", report.totals.negativeStockItems],
      ]),
    },
    {
      columns: [
        "product_name",
        "sku",
        "category",
        "status",
        "stock_status",
        "stock_quantity",
        "low_stock_alert",
        "unit",
        "cost_price",
        "sale_price",
        "stock_value_at_cost",
        "stock_value_at_sale_price",
      ],
      name: "Stock Valuation",
      rows: report.rows.map((row) => ({
        category: row.category,
        cost_price: row.costPrice,
        low_stock_alert: row.lowStockAlert,
        product_name: row.productName,
        sale_price: row.salePrice,
        sku: row.sku,
        status: row.status,
        stock_quantity: row.stockQuantity,
        stock_status: stockStatusLabel(row.stockStatus),
        stock_value_at_cost: row.stockValue,
        stock_value_at_sale_price: row.stockQuantity * row.salePrice,
        unit: row.unit,
      })),
      totals: [
        "stock_quantity",
        "stock_value_at_cost",
        "stock_value_at_sale_price",
      ],
    },
    {
      columns: [
        "product_name",
        "sku",
        "stock_quantity",
        "low_stock_alert",
        "unit",
        "stock_value_at_cost",
      ],
      name: "Attention Needed",
      rows: report.rows
        .filter((row) => row.stockStatus !== "healthy")
        .map((row) => ({
          low_stock_alert: row.lowStockAlert,
          product_name: row.productName,
          sku: row.sku,
          stock_quantity: row.stockQuantity,
          stock_value_at_cost: row.stockValue,
          unit: row.unit,
        })),
      totals: ["stock_quantity", "stock_value_at_cost"],
    },
  ]);
}

export async function buildInventoryReportXlsx(
  businessId: string,
  filters: InventoryReportFilters,
): Promise<ReportExport> {
  const business = await getBusiness(businessId);
  const selectedType = movementTypeOptions.includes(
    filters.type as (typeof movementTypeOptions)[number],
  )
    ? filters.type
    : "";
  const fromDate = parseOptionalDate(filters.from);
  const toDate = parseOptionalDate(filters.to, true);
  const movementWhere: Prisma.InventoryMovementWhereInput = {
    businessId,
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(selectedType ? { type: selectedType } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };
  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
      where: {
        businessId,
        status: "active",
        type: "product",
      },
    }),
    prisma.inventoryMovement.findMany({
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            stockQuantity: true,
            unit: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      where: movementWhere,
    }),
  ]);
  const lowStockProducts = products.filter(
    (product) =>
      decimalNumber(product.lowStockAlert) > 0 &&
      decimalNumber(product.stockQuantity) <= decimalNumber(product.lowStockAlert),
  );
  const valuation = products.reduce(
    (total, product) =>
      total +
      decimalNumber(product.stockQuantity) * decimalNumber(product.costPrice),
    0,
  );
  const totalUnits = products.reduce(
    (total, product) => total + decimalNumber(product.stockQuantity),
    0,
  );
  const movementSummary = Array.from(
    movements
      .reduce((summary, movement) => {
        const existing = summary.get(movement.productId) ?? {
          count: 0,
          name: movement.product.name,
          net: 0,
          onHand: decimalNumber(movement.product.stockQuantity),
          productId: movement.productId,
          sku: movement.product.sku ?? "",
          stockIn: 0,
          stockOut: 0,
          unit: movement.product.unit || "units",
        };
        const quantity = decimalNumber(movement.quantity);

        existing.count += 1;
        existing.net += quantity;

        if (quantity >= 0) {
          existing.stockIn += quantity;
        } else {
          existing.stockOut += Math.abs(quantity);
        }

        summary.set(movement.productId, existing);

        return summary;
      }, new Map<string, {
        count: number;
        name: string;
        net: number;
        onHand: number;
        productId: string;
        sku: string;
        stockIn: number;
        stockOut: number;
        unit: string;
      }>())
      .values(),
  ).sort((left, right) => Math.abs(right.net) - Math.abs(left.net));
  const selectedProduct = filters.productId
    ? products.find((product) => product.id === filters.productId)
    : undefined;

  return reportExport(business.name, "inventory-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Inventory movement report"],
        ["Business", business.name],
        ["Currency", business.currency],
        ["Generated at", new Date()],
        ["Movement type", selectedType ? movementTypeLabel(selectedType) : "All movement types"],
        ["Product", selectedProduct?.name ?? "All products"],
        ["From", filters.from ?? ""],
        ["To", filters.to ?? ""],
        ["Stock items", products.length, "Active products with stock tracking"],
        ["Total units", totalUnits, "Current on-hand quantity"],
        ["Valuation", valuation, "On-hand stock at cost"],
        ["Low stock", lowStockProducts.length, "At or below alert threshold"],
        ["Movement records", movements.length],
      ]),
    },
    {
      columns: [
        "product_name",
        "sku",
        "stock_in",
        "stock_out",
        "net",
        "on_hand",
        "unit",
        "movement_count",
      ],
      name: "Movement Summary",
      rows: movementSummary.map((summary) => ({
        movement_count: summary.count,
        net: summary.net,
        on_hand: summary.onHand,
        product_name: summary.name,
        sku: summary.sku,
        stock_in: summary.stockIn,
        stock_out: summary.stockOut,
        unit: summary.unit,
      })),
      totals: ["stock_in", "stock_out", "net", "movement_count"],
    },
    {
      columns: [
        "product_name",
        "sku",
        "category",
        "stock_quantity",
        "low_stock_alert",
        "unit",
        "cost_price",
        "stock_value",
      ],
      name: "Current Stock",
      rows: products.map((product) => {
        const quantity = decimalNumber(product.stockQuantity);
        const costPrice = decimalNumber(product.costPrice);

        return {
          category: product.category,
          cost_price: costPrice,
          low_stock_alert: decimalNumber(product.lowStockAlert),
          product_name: product.name,
          sku: product.sku,
          stock_quantity: quantity,
          stock_value: quantity * costPrice,
          unit: product.unit,
        };
      }),
      totals: ["stock_quantity", "stock_value"],
    },
    {
      columns: [
        "product_name",
        "sku",
        "stock_quantity",
        "low_stock_alert",
        "unit",
      ],
      name: "Low Stock",
      rows: lowStockProducts.map((product) => ({
        low_stock_alert: decimalNumber(product.lowStockAlert),
        product_name: product.name,
        sku: product.sku,
        stock_quantity: decimalNumber(product.stockQuantity),
        unit: product.unit,
      })),
      totals: ["stock_quantity"],
    },
    {
      columns: [
        "created_at",
        "product_name",
        "sku",
        "movement_type",
        "source_invoice",
        "quantity",
        "unit",
        "unit_cost",
        "notes",
      ],
      name: "Movement Ledger",
      rows: movements.map((movement) => ({
        created_at: movement.createdAt,
        movement_type: movementTypeLabel(movement.type),
        notes: movement.notes,
        product_name: movement.product.name,
        quantity: decimalNumber(movement.quantity),
        sku: movement.product.sku,
        source_invoice: movement.invoice?.invoiceNumber,
        unit: movement.product.unit,
        unit_cost: decimalNumber(movement.unitCost),
      })),
      totals: ["quantity"],
    },
  ]);
}

export async function buildRefundsReportXlsx(
  businessId: string,
  filters: DateRangeFilters,
): Promise<ReportExport> {
  const business = await getBusiness(businessId);
  const defaults = defaultDateRange();
  const fromDate = parseDate(filters.from, defaults.from);
  const toDate = parseDate(filters.to, defaults.to, true);
  const fromInput = filters.from ?? dateInputValue(defaults.from);
  const toInput = filters.to ?? dateInputValue(defaults.to);
  const refunds = await prisma.refund.findMany({
    include: {
      customer: {
        select: {
          businessName: true,
          email: true,
          id: true,
          name: true,
          phone: true,
        },
      },
      invoice: {
        select: {
          invoiceDate: true,
          invoiceNumber: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      refundDate: "desc",
    },
    where: {
      businessId,
      refundDate: {
        gte: fromDate,
        lte: toDate,
      },
      status: "completed",
    },
  });
  const totalRefunded = refunds.reduce(
    (total, refund) => total + decimalNumber(refund.amount),
    0,
  );
  const totalReturnedQuantity = refunds.reduce(
    (total, refund) =>
      total +
      refund.items.reduce(
        (itemTotal, item) => itemTotal + decimalNumber(item.quantity),
        0,
      ),
    0,
  );
  const totalRestocked = refunds.reduce(
    (total, refund) =>
      total +
      refund.items.reduce(
        (itemTotal, item) => itemTotal + decimalNumber(item.restockQuantity),
        0,
      ),
    0,
  );
  const methodRows = Array.from(
    refunds
      .reduce((methodMap, refund) => {
        const existing = methodMap.get(refund.refundMethod) ?? {
          amount: 0,
          count: 0,
          method: refund.refundMethod,
        };

        existing.amount += decimalNumber(refund.amount);
        existing.count += 1;
        methodMap.set(refund.refundMethod, existing);

        return methodMap;
      }, new Map<string, { amount: number; count: number; method: string }>())
      .values(),
  ).sort((left, right) => right.amount - left.amount);
  const productRows = Array.from(
    refunds
      .flatMap((refund) => refund.items)
      .reduce((productMap, item) => {
        const key = item.product?.id ?? item.itemName;
        const existing = productMap.get(key) ?? {
          amount: 0,
          count: 0,
          name: item.product?.name ?? item.itemName,
          quantity: 0,
          restocked: 0,
          sku: item.product?.sku ?? "",
          unit: item.product?.unit ?? "units",
        };

        existing.amount += decimalNumber(item.refundAmount);
        existing.count += 1;
        existing.quantity += decimalNumber(item.quantity);
        existing.restocked += decimalNumber(item.restockQuantity);
        productMap.set(key, existing);

        return productMap;
      }, new Map<string, {
        amount: number;
        count: number;
        name: string;
        quantity: number;
        restocked: number;
        sku: string;
        unit: string;
      }>())
      .values(),
  ).sort((left, right) => right.amount - left.amount);
  const customerRows = Array.from(
    refunds
      .reduce((customerMap, refund) => {
        const key = refund.customer?.id ?? "walk-in";
        const existing = customerMap.get(key) ?? {
          amount: 0,
          businessName: refund.customer?.businessName ?? "",
          count: 0,
          email: refund.customer?.email ?? "",
          name: refund.customer?.name ?? "Walk-in/No customer",
          phone: refund.customer?.phone ?? "",
        };

        existing.amount += decimalNumber(refund.amount);
        existing.count += 1;
        customerMap.set(key, existing);

        return customerMap;
      }, new Map<string, {
        amount: number;
        businessName: string;
        count: number;
        email: string;
        name: string;
        phone: string;
      }>())
      .values(),
  ).sort((left, right) => right.amount - left.amount);
  const refundItemRows = refunds.flatMap((refund) =>
    refund.items.map((item) => ({
      customer_name: refund.customer?.name ?? "No customer",
      invoice_number: refund.invoice.invoiceNumber,
      item_name: item.itemName,
      product_name: item.product?.name ?? item.itemName,
      product_sku: item.product?.sku,
      quantity: decimalNumber(item.quantity),
      refund_amount: decimalNumber(item.refundAmount),
      refund_date: refund.refundDate,
      refund_number: refund.refundNumber,
      restock_quantity: decimalNumber(item.restockQuantity),
      unit: item.product?.unit ?? "units",
      unit_price: decimalNumber(item.unitPrice),
    })),
  );

  return reportExport(business.name, "refund-summary-report", [
    {
      columns: ["metric", "value", "notes"],
      name: "Summary",
      rows: summaryRows([
        ["Report", "Refund summary"],
        ["Business", business.name],
        ["Currency", business.currency],
        ["From", fromInput],
        ["To", toInput],
        ["Generated at", new Date()],
        ["Refunded amount", totalRefunded, `${refunds.length} completed refund records`],
        ["Returned quantity", totalReturnedQuantity],
        ["Restocked quantity", totalRestocked],
        ["Affected customers", customerRows.length],
      ]),
    },
    {
      columns: ["method", "amount", "count", "percent_of_refunds"],
      name: "Method Breakdown",
      rows: methodRows.map((method) => ({
        amount: method.amount,
        count: method.count,
        method: methodLabel(method.method),
        percent_of_refunds: percent(method.amount, totalRefunded),
      })),
      totals: ["amount", "count"],
    },
    {
      columns: [
        "product_name",
        "sku",
        "quantity",
        "restocked",
        "unit",
        "refund_count",
        "amount",
      ],
      name: "Product Impact",
      rows: productRows.map((product) => ({
        amount: product.amount,
        product_name: product.name,
        quantity: product.quantity,
        refund_count: product.count,
        restocked: product.restocked,
        sku: product.sku,
        unit: product.unit,
      })),
      totals: ["quantity", "restocked", "refund_count", "amount"],
    },
    {
      columns: [
        "customer_name",
        "business_name",
        "phone",
        "email",
        "refund_count",
        "amount",
      ],
      name: "Customer Impact",
      rows: customerRows.map((customer) => ({
        amount: customer.amount,
        business_name: customer.businessName,
        customer_name: customer.name,
        email: customer.email,
        phone: customer.phone,
        refund_count: customer.count,
      })),
      totals: ["refund_count", "amount"],
    },
    {
      columns: [
        "refund_number",
        "invoice_number",
        "invoice_date",
        "customer_name",
        "refund_date",
        "refund_method",
        "amount",
        "reason",
        "notes",
      ],
      name: "Refund Detail",
      rows: refunds.map((refund) => ({
        amount: decimalNumber(refund.amount),
        customer_name: refund.customer?.name ?? "No customer",
        invoice_date: refund.invoice.invoiceDate,
        invoice_number: refund.invoice.invoiceNumber,
        notes: refund.notes,
        reason: refund.reason,
        refund_date: refund.refundDate,
        refund_method: methodLabel(refund.refundMethod),
        refund_number: refund.refundNumber,
      })),
      totals: ["amount"],
    },
    {
      columns: [
        "refund_number",
        "invoice_number",
        "customer_name",
        "refund_date",
        "item_name",
        "product_name",
        "product_sku",
        "quantity",
        "unit",
        "unit_price",
        "refund_amount",
        "restock_quantity",
      ],
      name: "Refund Item Detail",
      rows: refundItemRows,
      totals: ["quantity", "refund_amount", "restock_quantity"],
    },
  ]);
}
