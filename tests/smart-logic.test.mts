import assert from "node:assert/strict";
import test from "node:test";

import { recommendTemplateForBusiness } from "../src/app/_backend/lib/invoice-templates.ts";
import {
  expenseCategoryFromText,
  inferSmartFieldsFromText,
  inferSmartInvoiceLineItemsFromText,
  normalizeDetectedDate,
  parseSmartInvoiceLine,
} from "../src/app/_backend/lib/import-smart-logic.ts";

// ─── Template Recommendation ────────────────────────────────────────────────

test("recommends compact layout for retail shop", () => {
  const result = recommendTemplateForBusiness("retail shop");
  assert.ok(result);
  assert.equal(result.layout, "compact");
});

test("recommends compact for pharmacy", () => {
  const result = recommendTemplateForBusiness("pharmacy store");
  assert.ok(result);
  assert.equal(result.layout, "compact");
});

test("recommends compact for grocery mart", () => {
  const result = recommendTemplateForBusiness("grocery mart");
  assert.ok(result);
  assert.equal(result.layout, "compact");
});

test("recommends classic with signature for clinic", () => {
  const result = recommendTemplateForBusiness("medical clinic");
  assert.ok(result);
  assert.equal(result.layout, "classic");
  assert.equal(result.suggestedSettings.showSignature, true);
  assert.equal(result.suggestedSettings.showStamp, true);
});

test("recommends classic for dental practice", () => {
  const result = recommendTemplateForBusiness("dental clinic");
  assert.ok(result);
  assert.equal(result.layout, "classic");
});

test("recommends classic for hospital", () => {
  const result = recommendTemplateForBusiness("hospital");
  assert.ok(result);
  assert.equal(result.layout, "classic");
});

test("recommends modern for freelancer", () => {
  const result = recommendTemplateForBusiness("freelancer");
  assert.ok(result);
  assert.equal(result.layout, "modern");
});

test("recommends modern for software agency", () => {
  const result = recommendTemplateForBusiness("software development agency");
  assert.ok(result);
  assert.equal(result.layout, "modern");
});

test("recommends modern for design studio", () => {
  const result = recommendTemplateForBusiness("design agency");
  assert.ok(result);
  assert.equal(result.layout, "modern");
});

test("recommends modern for marketing consultancy", () => {
  const result = recommendTemplateForBusiness("marketing consultancy");
  assert.ok(result);
  assert.equal(result.layout, "modern");
});

test("recommends classic with balance box for distributor", () => {
  const result = recommendTemplateForBusiness("wholesale distributor");
  assert.ok(result);
  assert.equal(result.layout, "classic");
  assert.equal(result.suggestedSettings.showBalanceBox, true);
});

test("recommends classic for trading company", () => {
  const result = recommendTemplateForBusiness("trading company");
  assert.ok(result);
  assert.equal(result.layout, "classic");
});

test("recommends classic for import/export", () => {
  const result = recommendTemplateForBusiness("import export business");
  assert.ok(result);
  assert.equal(result.layout, "classic");
});

test("recommends compact for restaurant", () => {
  const result = recommendTemplateForBusiness("restaurant");
  assert.ok(result);
  assert.equal(result.layout, "compact");
});

test("recommends compact for cafe", () => {
  const result = recommendTemplateForBusiness("cafe");
  assert.ok(result);
  assert.equal(result.layout, "compact");
});

test("recommends classic with signature for repair workshop", () => {
  const result = recommendTemplateForBusiness("repair workshop");
  assert.ok(result);
  assert.equal(result.layout, "classic");
  assert.equal(result.suggestedSettings.showSignature, true);
});

test("returns null for unknown category", () => {
  const result = recommendTemplateForBusiness("unknown xyz business");
  assert.equal(result, null);
});

test("returns null for null category", () => {
  const result = recommendTemplateForBusiness(null);
  assert.equal(result, null);
});

test("returns null for empty category", () => {
  const result = recommendTemplateForBusiness("");
  assert.equal(result, null);
});

// ─── Date Normalization ──────────────────────────────────────────────────────

test("normalizes ISO date", () => {
  assert.equal(normalizeDetectedDate("2026-06-25"), "2026-06-25");
});

test("normalizes DD/MM/YYYY", () => {
  assert.equal(normalizeDetectedDate("25/06/2026"), "2026-06-25");
});

test("normalizes DD-MM-YYYY", () => {
  assert.equal(normalizeDetectedDate("25-06-2026"), "2026-06-25");
});

test("normalizes DD Month YYYY", () => {
  assert.equal(normalizeDetectedDate("25 June 2026"), "2026-06-25");
});

test("normalizes Month DD, YYYY", () => {
  assert.equal(normalizeDetectedDate("June 25, 2026"), "2026-06-25");
});

test("normalizes abbreviated month", () => {
  assert.equal(normalizeDetectedDate("Jun 25, 2026"), "2026-06-25");
});

test("normalizes DD Jan YYYY", () => {
  assert.equal(normalizeDetectedDate("01 Jan 2026"), "2026-01-01");
});

test("returns null for garbage date", () => {
  assert.equal(normalizeDetectedDate("not a date"), null);
});

test("returns null for null", () => {
  assert.equal(normalizeDetectedDate(null), null);
});

// ─── Expense Category Detection ──────────────────────────────────────────────

test("detects Fuel from petrol receipt", () => {
  assert.equal(expenseCategoryFromText("PSO Petrol Station - Rs 5000 fuel"), "Fuel");
});

test("detects Fuel from diesel", () => {
  assert.equal(expenseCategoryFromText("diesel filled 50 litres"), "Fuel");
});

test("detects Rent from shop rent receipt", () => {
  assert.equal(expenseCategoryFromText("monthly shop rent paid to landlord"), "Rent");
});

test("detects Salary from payroll entry", () => {
  assert.equal(expenseCategoryFromText("monthly salary paid to staff"), "Salary");
});

test("detects Utilities from electricity bill", () => {
  assert.equal(expenseCategoryFromText("WAPDA electricity bill payment"), "Utilities");
});

test("detects Utilities from gas bill", () => {
  assert.equal(expenseCategoryFromText("gas bill for the month"), "Utilities");
});

test("detects Internet from broadband bill", () => {
  assert.equal(expenseCategoryFromText("PTCL broadband internet bill"), "Internet");
});

test("detects Purchases from supplier invoice", () => {
  assert.equal(expenseCategoryFromText("goods received from supplier - stock purchase"), "Purchases");
});

test("detects Office supplies from stationery", () => {
  assert.equal(expenseCategoryFromText("stationery and printer paper"), "Office supplies");
});

test("detects Repairs from maintenance work", () => {
  assert.equal(expenseCategoryFromText("AC repair and maintenance charge"), "Repairs");
});

test("detects Transport from delivery", () => {
  assert.equal(expenseCategoryFromText("delivery charges courier"), "Transport");
});

test("detects Meals from restaurant", () => {
  assert.equal(expenseCategoryFromText("lunch at restaurant for team"), "Meals");
});

test("returns null for unrecognized text", () => {
  assert.equal(expenseCategoryFromText("random text with no category hints"), null);
});

// ─── Invoice OCR – Retail Shop Scenario ─────────────────────────────────────

test("retail: extracts invoice fields from electronics shop invoice", () => {
  const fields = inferSmartFieldsFromText({
    confidence: 0.85,
    importType: "invoices",
    textContent: [
      "Al-Noor Electronics",
      "Invoice No: ANE-2026-0147",
      "Date: 15 June 2026",
      "Due Date: 30 June 2026",
      "Bill To: Hamza Mobile Shop",
      "Grand Total: PKR 43,000",
    ].join("\n"),
  });

  const get = (name: string) =>
    fields.find((f) => f.fieldName === name)?.extractedValue;

  assert.equal(get("invoiceNumber"), "ANE-2026-0147");
  assert.equal(get("invoiceDate"), "2026-06-15");
  assert.equal(get("dueDate"), "2026-06-30");
  assert.equal(get("customerName"), "Hamza Mobile Shop");
  assert.equal(get("grandTotal"), "43000");
});

test("retail: extracts line items from electronics invoice", () => {
  const lines = inferSmartInvoiceLineItemsFromText({
    confidence: 0.82,
    textContent: [
      "Samsung A15 2 12500 25000",
      "Screen Guard 5 150 750",
      "Charger Adaptor 3 800 2400",
    ].join("\n"),
  });

  assert.ok(lines.length >= 2);
  const names = lines.map((l) => l.productName.toLowerCase());
  assert.ok(names.some((n) => n.includes("samsung")));
  assert.ok(names.some((n) => n.includes("screen") || n.includes("guard") || n.includes("charger")));
});

// ─── Invoice OCR – Clinic Scenario ──────────────────────────────────────────

test("clinic: extracts invoice fields from medical invoice", () => {
  const fields = inferSmartFieldsFromText({
    confidence: 0.88,
    importType: "invoices",
    textContent: [
      "Shifa Medical Clinic",
      "Invoice #: SHF-2026-0089",
      "Invoice Date: 20 June 2026",
      "Bill To: Ahmed Khan",
      "Grand Total: PKR 3,500",
    ].join("\n"),
  });

  const get = (name: string) =>
    fields.find((f) => f.fieldName === name)?.extractedValue;

  assert.equal(get("invoiceNumber"), "SHF-2026-0089");
  assert.equal(get("customerName"), "Ahmed Khan");
  assert.equal(get("grandTotal"), "3500");
});

test("clinic: extracts line items from medical services invoice", () => {
  const lines = inferSmartInvoiceLineItemsFromText({
    confidence: 0.8,
    textContent: [
      "Consultation 1 1500 1500",
      "Blood Test CBC 1 800 800",
      "X-Ray Chest 1 1200 1200",
    ].join("\n"),
  });

  assert.ok(lines.length >= 2);
  const names = lines.map((l) => l.productName.toLowerCase());
  assert.ok(names.some((n) => n.includes("consultation") || n.includes("blood") || n.includes("x-ray")));
});

// ─── Invoice OCR – Freelancer Scenario ──────────────────────────────────────

test("freelancer: extracts invoice fields from project invoice", () => {
  const fields = inferSmartFieldsFromText({
    confidence: 0.9,
    importType: "invoices",
    textContent: [
      "Raees Design Studio",
      "Invoice Number: RDS-2026-055",
      "Date: 10 June 2026",
      "Due Date: 25 June 2026",
      "Client: TechStart Pakistan",
      "Subtotal: PKR 75,000",
      "Tax: PKR 0",
      "Total: PKR 75,000",
    ].join("\n"),
  });

  const get = (name: string) =>
    fields.find((f) => f.fieldName === name)?.extractedValue;

  assert.equal(get("invoiceNumber"), "RDS-2026-055");
  assert.equal(get("customerName"), "TechStart Pakistan");
  assert.equal(get("grandTotal"), "75000");
});

test("freelancer: extracts service line items from project invoice", () => {
  const lines = inferSmartInvoiceLineItemsFromText({
    confidence: 0.85,
    textContent: [
      "Website Design 1 50000 50000",
      "Logo Design 1 15000 15000",
      "Brand Guidelines 1 10000 10000",
    ].join("\n"),
  });

  assert.ok(lines.length >= 2);
  const names = lines.map((l) => l.productName.toLowerCase());
  assert.ok(names.some((n) => n.includes("website") || n.includes("logo") || n.includes("brand")));
});

// ─── Invoice OCR – Distributor Scenario ─────────────────────────────────────

test("distributor: extracts invoice fields from wholesale invoice", () => {
  const fields = inferSmartFieldsFromText({
    confidence: 0.87,
    importType: "invoices",
    textContent: [
      "Ahmed Brothers Wholesale",
      "Invoice No: ABW-2026-1203",
      "Invoice Date: 18 June 2026",
      "Due Date: 03 July 2026",
      "Bill To: City Hardware Store",
      "Subtotal: PKR 285,000",
      "Discount: PKR 5,700",
      "GST 17%: PKR 47,175",
      "Grand Total: PKR 326,475",
    ].join("\n"),
  });

  const get = (name: string) =>
    fields.find((f) => f.fieldName === name)?.extractedValue;

  assert.equal(get("invoiceNumber"), "ABW-2026-1203");
  assert.equal(get("customerName"), "City Hardware Store");
  assert.ok(get("grandTotal"));
});

test("distributor: extracts bulk product line items", () => {
  const lines = inferSmartInvoiceLineItemsFromText({
    confidence: 0.84,
    textContent: [
      "Cement Bag 50KG DG 100 1100 110000",
      "Paint Berger Weather Coat 20L 30 4500 135000",
      "Steel Rod 12mm 50 800 40000",
    ].join("\n"),
  });

  assert.ok(lines.length >= 2);
});

// ─── Expense OCR – All Business Types ────────────────────────────────────────

test("retail: extracts expense fields from supplier receipt", () => {
  const fields = inferSmartFieldsFromText({
    confidence: 0.8,
    importType: "expenses",
    textContent: [
      "Supplier: Samsung Pakistan",
      "Date: 22 June 2026",
      "Goods Received - Stock Purchase",
      "Total Amount: PKR 180,000",
      "Paid Via: Bank Transfer",
    ].join("\n"),
  });

  const get = (name: string) =>
    fields.find((f) => f.fieldName === name)?.extractedValue;

  assert.equal(get("vendor"), "Samsung Pakistan");
  assert.equal(get("amount"), "180000");
});

test("clinic: extracts expense from medical supplies receipt", () => {
  const fields = inferSmartFieldsFromText({
    confidence: 0.82,
    importType: "expenses",
    textContent: [
      "Vendor: Medex Pharma",
      "Receipt Date: 15 June 2026",
      "Medical supplies purchase",
      "Grand Total: PKR 12,500",
      "Payment Method: Cash",
    ].join("\n"),
  });

  const get = (name: string) =>
    fields.find((f) => f.fieldName === name)?.extractedValue;

  assert.equal(get("vendor"), "Medex Pharma");
  assert.equal(get("paymentMethod"), "Cash");
});

test("freelancer: extracts expense from software subscription", () => {
  const fields = inferSmartFieldsFromText({
    confidence: 0.78,
    importType: "expenses",
    textContent: [
      "Adobe Creative Cloud",
      "Date: 01 June 2026",
      "Monthly software subscription",
      "Amount Paid: PKR 8,500",
      "Paid Via: Credit Card",
    ].join("\n"),
  });

  const get = (name: string) =>
    fields.find((f) => f.fieldName === name)?.extractedValue;

  assert.ok(get("amount"));
  assert.equal(get("paymentMethod"), "Credit Card");
});

test("distributor: extracts expense from warehouse rent receipt", () => {
  const fields = inferSmartFieldsFromText({
    confidence: 0.83,
    importType: "expenses",
    textContent: [
      "Paid to: Karachi Industrial Estate",
      "Date: 01 June 2026",
      "Monthly warehouse rent payment",
      "Amount: PKR 95,000",
      "Cash",
    ].join("\n"),
  });

  const get = (name: string) =>
    fields.find((f) => f.fieldName === name)?.extractedValue;

  assert.equal(get("amount"), "95000");
  assert.ok(get("vendor"));
});

// ─── Invoice Line Item Parsing – Edge Cases ───────────────────────────────────

test("parses standard quantity-name-price-total line", () => {
  const line = parseSmartInvoiceLine("Samsung A15 2 12500 25000", 0.8);
  assert.ok(line);
  assert.equal(line.quantity, "2");
  assert.equal(line.unitPrice, "12500");
});

test("parses line without total (quantity name price)", () => {
  const line = parseSmartInvoiceLine("Consultation 1 1500", 0.8);
  assert.ok(line);
  assert.equal(line.quantity, "1");
  assert.equal(line.unitPrice, "1500");
});

test("parses fractional quantity", () => {
  const line = parseSmartInvoiceLine("Paint 2.5 4500 11250", 0.8);
  assert.ok(line);
  assert.equal(line.quantity, "2.5");
});

test("parses line with PKR prefix on price", () => {
  const line = parseSmartInvoiceLine("Logo Design 1 PKR 15000 15000", 0.8);
  assert.ok(line);
  assert.equal(line.unitPrice, "15000");
});

test("rejects line with no numeric data", () => {
  const line = parseSmartInvoiceLine("This is just a description line", 0.8);
  assert.equal(line, null);
});

test("rejects empty line", () => {
  const line = parseSmartInvoiceLine("", 0.8);
  assert.equal(line, null);
});

// ─── Inferring Multiple Line Items ──────────────────────────────────────────

test("deduplicates identical lines", () => {
  const lines = inferSmartInvoiceLineItemsFromText({
    confidence: 0.8,
    textContent: [
      "Cement Bag 10 1100 11000",
      "Cement Bag 10 1100 11000",
    ].join("\n"),
  });

  assert.equal(lines.length, 1);
});

test("handles mixed valid and invalid lines", () => {
  const lines = inferSmartInvoiceLineItemsFromText({
    confidence: 0.8,
    textContent: [
      "Terms and Conditions",
      "Samsung A15 2 12500 25000",
      "Please pay within 30 days",
      "Screen Guard 5 150 750",
    ].join("\n"),
  });

  assert.ok(lines.length >= 1);
  const names = lines.map((l) => l.productName.toLowerCase());
  assert.ok(names.some((n) => n.includes("samsung") || n.includes("screen")));
});

test("returns empty array for plain text with no line items", () => {
  const lines = inferSmartInvoiceLineItemsFromText({
    confidence: 0.7,
    textContent: "Thank you for your business. Please contact us for queries.",
  });

  assert.equal(lines.length, 0);
});

// ─── Expense Category from Retail Receipts ────────────────────────────────────

test("classifies electricity bill as Utilities", () => {
  assert.equal(
    expenseCategoryFromText("K-Electric electricity bill June 2026 amount due PKR 12000"),
    "Utilities",
  );
});

test("classifies petrol station receipt as Fuel", () => {
  assert.equal(
    expenseCategoryFromText("Total Parco petrol station PKR 5000"),
    "Fuel",
  );
});

test("classifies staff salary as Salary", () => {
  assert.equal(
    expenseCategoryFromText("June 2026 payroll - staff salary"),
    "Salary",
  );
});

test("classifies courier payment as Transport", () => {
  assert.equal(
    expenseCategoryFromText("TCS courier delivery charges paid"),
    "Transport",
  );
});

test("classifies internet bill as Internet", () => {
  assert.equal(
    expenseCategoryFromText("StormFiber broadband internet bill"),
    "Internet",
  );
});
