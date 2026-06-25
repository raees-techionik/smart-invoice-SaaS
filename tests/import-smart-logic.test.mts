import assert from "node:assert/strict";
import test from "node:test";

import {
  inferSmartFieldsFromText,
  inferSmartInvoiceLineItemsFromText,
  normalizeDetectedDate,
} from "../src/app/_backend/lib/import-smart-logic.ts";

function extractedValue(
  fields: ReturnType<typeof inferSmartFieldsFromText>,
  fieldName: string,
) {
  return fields.find((field) => field.fieldName === fieldName)?.extractedValue;
}

test("normalizes common invoice date formats", () => {
  assert.equal(normalizeDetectedDate("2026-06-12"), "2026-06-12");
  assert.equal(normalizeDetectedDate("12/06/2026"), "2026-06-12");
  assert.equal(normalizeDetectedDate("12 June 2026"), "2026-06-12");
  assert.equal(normalizeDetectedDate("Jun 12, 2026"), "2026-06-12");
});

test("infers invoice labels from OCR text", () => {
  const fields = inferSmartFieldsFromText({
    confidence: 0.82,
    importType: "invoices",
    textContent: [
      "Tax Invoice: TX-999",
      "Date: 12 June 2026",
      "Bill To: Ahmed Traders",
      "Subtotal: PKR 3,600",
      "GST: PKR 0",
      "Grand Total: PKR 3,600",
    ].join("\n"),
  });

  assert.equal(extractedValue(fields, "invoiceNumber"), "TX-999");
  assert.equal(extractedValue(fields, "invoiceDate"), "2026-06-12");
  assert.equal(extractedValue(fields, "customerName"), "Ahmed Traders");
  assert.equal(extractedValue(fields, "subtotal"), "3600");
  assert.equal(extractedValue(fields, "grandTotal"), "3600");
});

test("parses invoice line rows and rewards matching totals", () => {
  const [line] = inferSmartInvoiceLineItemsFromText({
    confidence: 0.72,
    textContent: "Cement Bag 50KG 3 1,200 3,600",
  });

  assert.equal(line?.productName, "Cement Bag 50KG");
  assert.equal(line?.quantity, "3");
  assert.equal(line?.unitPrice, "1200");
  assert.equal(line?.lineTotal, "3600");
  assert.ok((line?.confidence ?? 0) > 0.72);
});

test("lowers invoice line confidence when row total does not match", () => {
  const [line] = inferSmartInvoiceLineItemsFromText({
    confidence: 0.72,
    textContent: "Paint Bucket 2 2500 4000",
  });

  assert.equal(line?.productName, "Paint Bucket");
  assert.ok((line?.confidence ?? 1) < 0.72);
});

test("infers purchase receipts as expenses", () => {
  const fields = inferSmartFieldsFromText({
    confidence: 0.78,
    importType: "expenses",
    textContent: [
      "Supplier: Ali Traders",
      "Receipt Date: 2026-06-12",
      "Stock purchase bill",
      "Total: PKR 1,500",
      "Paid cash",
    ].join("\n"),
  });

  assert.equal(extractedValue(fields, "vendor"), "Ali Traders");
  assert.equal(extractedValue(fields, "date"), "2026-06-12");
  assert.equal(extractedValue(fields, "category"), "Purchases");
  assert.equal(extractedValue(fields, "amount"), "1500");
  assert.equal(extractedValue(fields, "paymentMethod"), "cash");
});
