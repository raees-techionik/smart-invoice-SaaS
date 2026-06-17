import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import {
  contentTypeForUploadPath,
  resolveStoredUploadPath,
} from "@/app/_backend/lib/uploads";

export const runtime = "nodejs";

type ExpenseReceiptRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: ExpenseReceiptRouteProps,
) {
  const user = await requireUser();
  const { id } = await params;

  const expense = await prisma.expense.findFirst({
    select: {
      attachmentPath: true,
    },
    where: {
      businessId: user.businessId,
      id,
    },
  });

  if (!expense?.attachmentPath) {
    return new NextResponse("Receipt not found.", { status: 404 });
  }

  const absolutePath = resolveStoredUploadPath(
    expense.attachmentPath,
    "receipts",
  );

  if (!absolutePath) {
    return new NextResponse("Receipt not found.", { status: 404 });
  }

  try {
    const [fileBuffer, fileStat] = await Promise.all([
      readFile(absolutePath),
      stat(absolutePath),
    ]);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
        "Content-Disposition": `inline; filename="${path.basename(
          expense.attachmentPath,
        )}"`,
        "Content-Length": String(fileStat.size),
        "Content-Type": contentTypeForUploadPath(expense.attachmentPath),
      },
    });
  } catch {
    return new NextResponse("Receipt not found.", { status: 404 });
  }
}
