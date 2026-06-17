import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { buildXlsxExport, isCsvExportDataset } from "@/app/_backend/lib/exports";

export const runtime = "nodejs";

type XlsxExportRouteProps = {
  params: Promise<{
    dataset: string;
  }>;
};

export async function GET(_request: Request, { params }: XlsxExportRouteProps) {
  const user = await requireUser();
  const { dataset } = await params;

  if (!isCsvExportDataset(dataset)) {
    return new NextResponse("Export not found.", { status: 404 });
  }

  const exportFile = await buildXlsxExport(dataset, user.businessId);

  return new NextResponse(new Uint8Array(exportFile.buffer), {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
