export type SmartImportType = "expenses" | "invoices";

export type SmartExtractedField = {
  confidence: number;
  extractedValue: string | null;
  fieldName: string;
  status: string;
};

export type SmartInvoiceLine = {
  confidence: number;
  itemDescription: string | null;
  lineTotal: string | null;
  productName: string;
  quantity: string;
  unitPrice: string;
};

const monthNumbers: Record<string, number> = {
  apr: 4,
  april: 4,
  aug: 8,
  august: 8,
  dec: 12,
  december: 12,
  feb: 2,
  february: 2,
  jan: 1,
  january: 1,
  jul: 7,
  july: 7,
  jun: 6,
  june: 6,
  mar: 3,
  march: 3,
  may: 5,
  nov: 11,
  november: 11,
  oct: 10,
  october: 10,
  sep: 9,
  sept: 9,
  september: 9,
};

function numericMatch(textContent: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = textContent.match(pattern);
    const value = match?.[1]?.replace(/[^\d.-]/g, "");

    if (value) {
      return value;
    }
  }

  return null;
}

function textMatch(textContent: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = textContent.match(pattern);
    const value = match?.[1]?.trim();

    if (value) {
      return value.replace(/\s{2,}/g, " ");
    }
  }

  return null;
}

function inferredField(
  fieldName: string,
  extractedValue: string | null,
  confidence: number,
): SmartExtractedField | null {
  if (!extractedValue) {
    return null;
  }

  return {
    confidence,
    extractedValue,
    fieldName,
    status: confidence >= 0.75 ? "extracted" : "needs_review",
  };
}

function decimalText(value: string | null | undefined) {
  const normalizedValue = (value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");

  if (!normalizedValue || !/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const latestReasonableDate = new Date();
  latestReasonableDate.setUTCFullYear(latestReasonableDate.getUTCFullYear() + 10);

  if (date > latestReasonableDate) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeYear(value: number) {
  if (value < 100) {
    return value >= 70 ? 1900 + value : 2000 + value;
  }

  return value;
}

export function normalizeDetectedDate(value: string | null | undefined) {
  const rawValue = (value ?? "").replace(/,/g, " ").replace(/\s+/g, " ").trim();

  if (!rawValue) {
    return null;
  }

  const yearFirstMatch = rawValue.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);

  if (yearFirstMatch) {
    return isoDate(
      Number(yearFirstMatch[1]),
      Number(yearFirstMatch[2]),
      Number(yearFirstMatch[3]),
    );
  }

  const slashMatch = rawValue.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);

  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = normalizeYear(Number(slashMatch[3]));
    const day = second > 12 && first <= 12 ? second : first;
    const month = second > 12 && first <= 12 ? first : second;

    return isoDate(year, month, day);
  }

  const dayMonthNameMatch = rawValue.match(
    /^(\d{1,2})\s+([a-z]{3,9})\s+(\d{2,4})$/i,
  );

  if (dayMonthNameMatch) {
    return isoDate(
      normalizeYear(Number(dayMonthNameMatch[3])),
      monthNumbers[dayMonthNameMatch[2].toLowerCase()] ?? 0,
      Number(dayMonthNameMatch[1]),
    );
  }

  const monthNameDayMatch = rawValue.match(
    /^([a-z]{3,9})\s+(\d{1,2})\s+(\d{2,4})$/i,
  );

  if (monthNameDayMatch) {
    return isoDate(
      normalizeYear(Number(monthNameDayMatch[3])),
      monthNumbers[monthNameDayMatch[1].toLowerCase()] ?? 0,
      Number(monthNameDayMatch[2]),
    );
  }

  return null;
}

function dateMatch(textContent: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = textContent.match(pattern);
    const normalizedDate = normalizeDetectedDate(match?.[1]);

    if (normalizedDate) {
      return normalizedDate;
    }
  }

  return null;
}

function likelyInvoiceLineText(line: string) {
  const ignoredLinePattern =
    /\b(invoice|bill\s*to|customer|client|buyer|date|due|subtotal|sub\s*total|grand\s*total|total|tax|vat|gst|discount|balance|amount\s*due|terms|notes|thank\s*you|signature|authorized)\b/i;
  const alphaCount = (line.match(/[a-z]/gi) ?? []).length;
  const numberCount = (line.match(/\d+(?:,\d{3})*(?:\.\d{1,2})?/g) ?? []).length;

  return alphaCount >= 2 && numberCount >= 2 && !ignoredLinePattern.test(line);
}

function normalizeProductName(value: string) {
  return value
    .replace(/^[#*\-\d.\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function lineConfidence(
  confidence: number,
  quantity: string,
  unitPrice: string,
  lineTotal: string | null,
) {
  if (!lineTotal) {
    return confidence;
  }

  const expected = Number(quantity) * Number(unitPrice);
  const actual = Number(lineTotal);

  if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
    return Math.max(confidence - 0.08, 0.2);
  }

  return Math.abs(expected - actual) <= 0.01
    ? Math.min(confidence + 0.1, 0.92)
    : Math.max(confidence - 0.18, 0.2);
}

export function parseSmartInvoiceLine(
  line: string,
  confidence: number,
): SmartInvoiceLine | null {
  const compactLine = line.replace(/\s+/g, " ").trim();

  if (!likelyInvoiceLineText(compactLine)) {
    return null;
  }

  const quantityPriceTotalMatch = compactLine.match(
    /^(.+?)\s+(\d+(?:\.\d{1,2})?)\s+(?:x\s*)?(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)(?:\s+(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?))?$/i,
  );

  if (!quantityPriceTotalMatch) {
    return null;
  }

  const productName = normalizeProductName(quantityPriceTotalMatch[1] ?? "");
  const quantity = decimalText(quantityPriceTotalMatch[2]);
  const unitPrice = decimalText(quantityPriceTotalMatch[3]);
  const lineTotal = decimalText(quantityPriceTotalMatch[4]);

  if (!productName || !quantity || !unitPrice) {
    return null;
  }

  return {
    confidence: lineConfidence(confidence, quantity, unitPrice, lineTotal),
    itemDescription: productName,
    lineTotal,
    productName,
    quantity,
    unitPrice,
  };
}

export function inferSmartInvoiceLineItemsFromText({
  confidence,
  textContent,
}: {
  confidence?: number;
  textContent: string;
}) {
  const baseConfidence = Math.min(Math.max(confidence ?? 0.45, 0.3), 0.78);
  const lines = textContent
    .replace(/\r/g, "\n")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsedLines = lines
    .map((line) => parseSmartInvoiceLine(line, baseConfidence))
    .filter((line): line is SmartInvoiceLine => Boolean(line));
  const uniqueLines = new Map<string, SmartInvoiceLine>();

  for (const line of parsedLines) {
    const key = `${line.productName.toLowerCase()}|${line.quantity}|${line.unitPrice}`;

    if (!uniqueLines.has(key)) {
      uniqueLines.set(key, line);
    }
  }

  return [...uniqueLines.values()].slice(0, 50);
}

function receiptVendorFallback(textContent: string) {
  const ignoredLinePattern =
    /\b(receipt|invoice|bill|date|time|total|amount|subtotal|tax|vat|gst|payment|method|cash|card|qty|quantity|price|page)\b/i;
  const lines = textContent
    .split(/\r?\n/)
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter((line) => {
      const alphaCount = (line.match(/[a-z]/gi) ?? []).length;

      return (
        alphaCount >= 3 &&
        line.length <= 70 &&
        !ignoredLinePattern.test(line) &&
        !/^[\d\s.,:/#-]+$/.test(line)
      );
    });

  return lines[0] ?? null;
}

export function expenseCategoryFromText(textContent: string) {
  const lowerText = textContent.toLowerCase();
  const categoryPatterns: Array<[string, RegExp]> = [
    ["Fuel", /\b(fuel|petrol|diesel|gas station|cng)\b/],
    ["Rent", /\b(rent|lease)\b/],
    ["Salary", /\b(salary|wage|payroll)\b/],
    ["Utilities", /\b(utility|utilities|electricity|water|gas bill)\b/],
    ["Internet", /\b(internet|broadband|wifi|data package)\b/],
    ["Purchases", /\b(purchase|purchases|supplier|goods received|stock purchase)\b/],
    ["Office supplies", /\b(stationery|supplies|paper|printer|ink)\b/],
    ["Repairs", /\b(repair|maintenance|service charge)\b/],
    ["Transport", /\b(transport|taxi|ride|delivery|courier|freight)\b/],
    ["Meals", /\b(meal|food|restaurant|lunch|dinner|tea|coffee)\b/],
  ];

  return categoryPatterns.find(([, pattern]) => pattern.test(lowerText))?.[0] ?? null;
}

function inferExpenseFields(textContent: string, confidence?: number) {
  const baseConfidence = Math.min(Math.max(confidence ?? 0.5, 0.3), 0.86);
  const compactText = textContent.replace(/\r/g, "\n");
  const labeledVendor = textMatch(compactText, [
    /(?:vendor|merchant|supplier|store|shop|paid\s*to)\s*[:#-]?\s*([^\n]+)/i,
  ]);
  const vendor = labeledVendor ?? receiptVendorFallback(compactText);
  const vendorConfidence = labeledVendor ? baseConfidence - 0.1 : baseConfidence - 0.28;
  const inferredCategory = expenseCategoryFromText(compactText);
  const paymentMethod = textMatch(compactText, [
    /\b(cash|card|credit card|debit card|bank transfer|easypaisa|jazzcash|cheque|check)\b/i,
  ]);
  const fields = [
    inferredField(
      "date",
      dateMatch(compactText, [
        /(?:receipt\s*)?date\s*[:#-]?\s*([^\n]+)/i,
        /paid\s*on\s*[:#-]?\s*([^\n]+)/i,
        /\b(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\b/i,
        /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/i,
        /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i,
        /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/i,
      ]),
      baseConfidence - 0.05,
    ),
    inferredField("vendor", vendor, vendorConfidence),
    inferredField("category", inferredCategory, baseConfidence - 0.2),
    inferredField(
      "amount",
      numericMatch(compactText, [
        /(?:grand\s*)?total\s*[:#-]?\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        /(?:net\s*)?amount\s*(?:paid|due)?\s*[:#-]?\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        /balance\s*(?:due)?\s*[:#-]?\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        /amount\s*(?:paid|due)?\s*[:#-]?\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        /paid\s*[:#-]?\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
      ]),
      baseConfidence,
    ),
    inferredField("paymentMethod", paymentMethod, baseConfidence - 0.15),
  ];

  return fields.filter((field): field is SmartExtractedField => Boolean(field));
}

function inferInvoiceFields(textContent: string, confidence?: number) {
  const baseConfidence = Math.min(Math.max(confidence ?? 0.55, 0.35), 0.9);
  const compactText = textContent.replace(/\r/g, "\n");
  const fields = [
    inferredField(
      "invoiceNumber",
      textMatch(compactText, [
        /(?:invoice|inv|bill|receipt|tax\s*invoice|ref)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{1,})/i,
      ]),
      baseConfidence,
    ),
    inferredField(
      "invoiceDate",
      dateMatch(compactText, [
        /(?:invoice\s*)?date\s*[:#-]?\s*([^\n]+)/i,
        /\b(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\b/i,
        /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/i,
        /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i,
        /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/i,
      ]),
      baseConfidence - 0.05,
    ),
    inferredField(
      "dueDate",
      dateMatch(compactText, [
        /due\s*date\s*[:#-]?\s*([^\n]+)/i,
        /payment\s*due\s*[:#-]?\s*([^\n]+)/i,
      ]),
      baseConfidence - 0.12,
    ),
    inferredField(
      "customerName",
      textMatch(compactText, [
        /(?:customer|client|buyer|bill\s*to)\s*[:#-]?\s*([^\n]+)/i,
      ]),
      baseConfidence - 0.1,
    ),
    inferredField(
      "subtotal",
      numericMatch(compactText, [
        /subtotal\s*[:#-]?\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
      ]),
      baseConfidence - 0.05,
    ),
    inferredField(
      "taxTotal",
      numericMatch(compactText, [
        /(?:tax|gst|vat)\s*(?:total|amount)?\s*[:#-]?\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
      ]),
      baseConfidence - 0.1,
    ),
    inferredField(
      "discountTotal",
      numericMatch(compactText, [
        /discount\s*(?:total|amount)?\s*[:#-]?\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
      ]),
      baseConfidence - 0.1,
    ),
    inferredField(
      "grandTotal",
      numericMatch(compactText, [
        /(?:grand\s*)?total\s*[:#-]?\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        /amount\s*due\s*[:#-]?\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
      ]),
      baseConfidence,
    ),
  ];

  return fields.filter((field): field is SmartExtractedField => Boolean(field));
}

export function inferSmartFieldsFromText({
  confidence,
  importType,
  textContent,
}: {
  confidence?: number;
  importType: SmartImportType | string;
  textContent: string;
}) {
  if (importType === "expenses") {
    return inferExpenseFields(textContent, confidence);
  }

  if (importType === "invoices") {
    return inferInvoiceFields(textContent, confidence);
  }

  return [];
}
