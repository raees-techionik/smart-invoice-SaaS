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

type ReportExportAuditInput = {
  businessId: string;
  exportFile: ReportExport;
  filters: Record<string, string | null | undefined>;
  userId?: string | null;
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

  if (/amount|balance|cost|expense|price|profit|receivable|revenue|total|valuation|value/.test(column)) {
    return "currency";
  }

  if (/alert|margin|net|percent|quantity|restocked|stock|units/.test(column)) {
    return "decimal";
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
