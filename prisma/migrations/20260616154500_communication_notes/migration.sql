-- CreateTable
CREATE TABLE "CommunicationNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "invoiceId" TEXT,
    "createdById" TEXT,
    "type" TEXT NOT NULL DEFAULT 'note',
    "body" TEXT NOT NULL,
    "followUpAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommunicationNote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunicationNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommunicationNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunicationNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CommunicationNote_businessId_idx" ON "CommunicationNote"("businessId");

-- CreateIndex
CREATE INDEX "CommunicationNote_customerId_idx" ON "CommunicationNote"("customerId");

-- CreateIndex
CREATE INDEX "CommunicationNote_invoiceId_idx" ON "CommunicationNote"("invoiceId");

-- CreateIndex
CREATE INDEX "CommunicationNote_createdAt_idx" ON "CommunicationNote"("createdAt");

-- CreateIndex
CREATE INDEX "CommunicationNote_followUpAt_idx" ON "CommunicationNote"("followUpAt");
