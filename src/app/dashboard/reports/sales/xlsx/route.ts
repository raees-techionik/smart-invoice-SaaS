import { NextResponse } from "next/server";

import { requireReportViewer } from "@/app/_backend/lib/auth/roles";
import {
  buildSalesTrendReportXlsx,
  recordReportExportAudit,
} from "@/app/_backend/lib/report-exports";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireReportViewer();
  const searchParams = new URL(request.url).searchParams;
  const filters = {
    from: searchParams.get("from"),
    mode: searchParams.get("mode"),
    to: searchParams.get("to"),
  };
  const exportFile = await buildSalesTrendReportXlsx(user.businessId, filters);

  await recordReportExportAudit({
    businessId: user.businessId,
    exportFile,
    filters,
    userId: user.id,
  });

  return new NextResponse(new Uint8Array(exportFile.buffer), {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
