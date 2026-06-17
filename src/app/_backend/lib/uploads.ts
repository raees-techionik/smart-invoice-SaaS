import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const receiptFileTypes = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const importFileTypes = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["text/csv", ".csv"],
  ["text/plain", ".txt"],
  ["application/vnd.ms-excel", ".csv"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xlsx",
  ],
]);

const contentTypesByExtension = new Map([
  [".csv", "text/csv"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".txt", "text/plain"],
  [".webp", "image/webp"],
  [
    ".xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
]);

const maxReceiptUploadBytes = 5 * 1024 * 1024;
const maxImportUploadBytes = 10 * 1024 * 1024;

export async function saveExpenseReceiptFile(file: File) {
  if (!file || file.size === 0) {
    return null;
  }

  const extension = receiptFileTypes.get(file.type);

  if (!extension) {
    return {
      error: "Receipt must be a PDF, JPG, PNG, or WebP file.",
    };
  }

  if (file.size > maxReceiptUploadBytes) {
    return {
      error: "Receipt must be 5 MB or smaller.",
    };
  }

  const uploadRoot = path.join(process.cwd(), "uploads", "receipts");
  const filename = `receipt-${randomUUID()}${extension}`;
  const absolutePath = path.join(uploadRoot, filename);
  const relativePath = path.posix.join("uploads", "receipts", filename);

  await mkdir(uploadRoot, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    path: relativePath,
  };
}

export async function saveImportSourceFile(file: File, fileBuffer?: Buffer) {
  if (!file || file.size === 0) {
    return null;
  }

  const extension = importFileTypes.get(file.type);

  if (!extension) {
    return {
      error: "Import file must be a PDF, image, CSV, TXT, or XLSX file.",
    };
  }

  if (file.size > maxImportUploadBytes) {
    return {
      error: "Import file must be 10 MB or smaller.",
    };
  }

  const uploadRoot = path.join(process.cwd(), "uploads", "imports");
  const filename = `import-${randomUUID()}${extension}`;
  const absolutePath = path.join(uploadRoot, filename);
  const relativePath = path.posix.join("uploads", "imports", filename);
  const savedBuffer = fileBuffer ?? Buffer.from(await file.arrayBuffer());

  await mkdir(uploadRoot, { recursive: true });
  await writeFile(absolutePath, savedBuffer);

  return {
    hash: createHash("sha256").update(savedBuffer).digest("hex"),
    path: relativePath,
    size: savedBuffer.length,
  };
}

export function resolveStoredUploadPath(
  storedPath: string,
  uploadDir: "imports" | "receipts",
) {
  const uploadRoot = path.resolve(process.cwd(), "uploads", uploadDir);
  const absolutePath = path.resolve(process.cwd(), storedPath);
  const relativePath = path.relative(uploadRoot, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

export function contentTypeForUploadPath(storedPath: string) {
  const extension = path.extname(storedPath).toLowerCase();

  return contentTypesByExtension.get(extension) ?? "application/octet-stream";
}
