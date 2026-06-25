import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import {
  buildGenericImportJobXlsx,
  buildInvoiceImportJobXlsx,
} from "@/app/_backend/lib/import-job-exports";
import { prisma } from "@/app/_backend/lib/db/prisma";

export const runtime = "nodejs";

type ImportJobXlsxRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: ImportJobXlsxRouteProps) {
  const user = await requireUser();
  const { id } = await params;

  const importJob = await prisma.importJob.findFirst({
    select: { importType: true },
    where: { businessId: user.businessId, id },
  });

  if (!importJob) {
    return new NextResponse("Import job not found.", { status: 404 });
  }

  const exportFile =
    importJob.importType === "invoices"
      ? await buildInvoiceImportJobXlsx(user.businessId, id)
      : await buildGenericImportJobXlsx(user.businessId, id);

  if (!exportFile) {
    return new NextResponse("Export not available.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(exportFile.buffer), {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
