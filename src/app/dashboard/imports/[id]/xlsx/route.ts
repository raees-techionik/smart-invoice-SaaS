import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { buildInvoiceImportJobXlsx } from "@/app/_backend/lib/import-job-exports";

export const runtime = "nodejs";

type ImportJobXlsxRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: ImportJobXlsxRouteProps) {
  const user = await requireUser();
  const { id } = await params;
  const exportFile = await buildInvoiceImportJobXlsx(user.businessId, id);

  if (!exportFile) {
    return new NextResponse("Invoice import export not found.", { status: 404 });
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
