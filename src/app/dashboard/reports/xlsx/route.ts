import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import {
  buildProfitLossReportXlsx,
  recordReportExportAudit,
} from "@/app/_backend/lib/report-exports";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireUser();
  const searchParams = new URL(request.url).searchParams;
  const filters = {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  };
  const exportFile = await buildProfitLossReportXlsx(user.businessId, filters);

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
