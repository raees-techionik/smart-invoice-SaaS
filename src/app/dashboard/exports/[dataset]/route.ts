import { NextResponse } from "next/server";

import { requireDataExporter } from "@/app/_backend/lib/auth/roles";
import { buildCsvExport, isCsvExportDataset } from "@/app/_backend/lib/exports";

export const runtime = "nodejs";

type CsvExportRouteProps = {
  params: Promise<{
    dataset: string;
  }>;
};

export async function GET(_request: Request, { params }: CsvExportRouteProps) {
  const user = await requireDataExporter();
  const { dataset } = await params;

  if (!isCsvExportDataset(dataset)) {
    return new NextResponse("Export not found.", { status: 404 });
  }

  const csvExport = await buildCsvExport(dataset, user.businessId);

  return new NextResponse(`\ufeff${csvExport.csv}`, {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${csvExport.filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
