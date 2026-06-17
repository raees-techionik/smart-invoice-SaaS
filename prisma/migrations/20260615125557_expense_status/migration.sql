-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "createdById" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "vendor" TEXT,
    "notes" TEXT,
    "attachmentPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "attachmentPath", "businessId", "category", "createdAt", "createdById", "date", "id", "notes", "paymentMethod", "updatedAt", "vendor") SELECT "amount", "attachmentPath", "businessId", "category", "createdAt", "createdById", "date", "id", "notes", "paymentMethod", "updatedAt", "vendor" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_businessId_idx" ON "Expense"("businessId");
CREATE INDEX "Expense_businessId_date_idx" ON "Expense"("businessId", "date");
CREATE INDEX "Expense_businessId_category_idx" ON "Expense"("businessId", "category");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
