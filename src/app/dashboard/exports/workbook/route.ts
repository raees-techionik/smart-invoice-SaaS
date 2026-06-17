import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { buildBusinessWorkbookExport } from "@/app/_backend/lib/exports";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  const exportFile = await buildBusinessWorkbookExport(user.businessId);

  return new NextResponse(new Uint8Array(exportFile.buffer), {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
