-- CreateTable
CREATE TABLE "InvoiceEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "createdById" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "ccEmail" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "preparedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceEmail_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceEmail_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceEmail_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InvoiceEmail_businessId_idx" ON "InvoiceEmail"("businessId");

-- CreateIndex
CREATE INDEX "InvoiceEmail_invoiceId_idx" ON "InvoiceEmail"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceEmail_businessId_status_idx" ON "InvoiceEmail"("businessId", "status");

-- CreateIndex
CREATE INDEX "InvoiceEmail_preparedAt_idx" ON "InvoiceEmail"("preparedAt");
