import { readFile, stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import {
  contentTypeForUploadPath,
  resolveStoredUploadPath,
} from "@/app/_backend/lib/uploads";

export const runtime = "nodejs";

type ImportDocumentFileRouteProps = {
  params: Promise<{
    documentId: string;
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: ImportDocumentFileRouteProps,
) {
  const user = await requireUser();
  const { documentId, id } = await params;

  const document = await prisma.importedDocument.findFirst({
    select: {
      filePath: true,
      originalFileName: true,
    },
    where: {
      businessId: user.businessId,
      id: documentId,
      importJobId: id,
    },
  });

  if (!document) {
    return new NextResponse("Imported document not found.", { status: 404 });
  }

  const absolutePath = resolveStoredUploadPath(document.filePath, "imports");

  if (!absolutePath) {
    return new NextResponse("Imported document not found.", { status: 404 });
  }

  try {
    const [fileBuffer, fileStat] = await Promise.all([
      readFile(absolutePath),
      stat(absolutePath),
    ]);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
        "Content-Disposition": `inline; filename="${document.originalFileName.replace(
          /"/g,
          "",
        )}"`,
        "Content-Length": String(fileStat.size),
        "Content-Type": contentTypeForUploadPath(document.filePath),
      },
    });
  } catch {
    return new NextResponse("Imported document not found.", { status: 404 });
  }
}
