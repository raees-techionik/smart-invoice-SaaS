-- CreateTable
CREATE TABLE "ExportAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "createdById" TEXT,
    "exportType" TEXT NOT NULL DEFAULT 'report',
    "reportName" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'xlsx',
    "filename" TEXT NOT NULL,
    "filtersJson" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportAuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExportAuditLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExportAuditLog_businessId_idx" ON "ExportAuditLog"("businessId");

-- CreateIndex
CREATE INDEX "ExportAuditLog_createdById_idx" ON "ExportAuditLog"("createdById");

-- CreateIndex
CREATE INDEX "ExportAuditLog_businessId_reportName_idx" ON "ExportAuditLog"("businessId", "reportName");

-- CreateIndex
CREATE INDEX "ExportAuditLog_businessId_createdAt_idx" ON "ExportAuditLog"("businessId", "createdAt");
