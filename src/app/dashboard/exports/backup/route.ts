import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { buildBusinessBackupExport } from "@/app/_backend/lib/exports";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  const backupExport = await buildBusinessBackupExport(user.businessId);

  return NextResponse.json(backupExport.backup, {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${backupExport.filename}"`,
    },
  });
}
